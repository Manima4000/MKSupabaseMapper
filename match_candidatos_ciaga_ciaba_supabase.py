import urllib.request
import json
import time
import unicodedata
import re
import difflib
import csv

def normalize_name(name):
    if not name:
        return '', []
    nfd = unicodedata.normalize('NFD', name)
    no_accents = ''.join(c for c in nfd if unicodedata.category(c) != 'Mn').upper()
    clean = re.sub(r'[^A-Z0-9\s]', ' ', no_accents)
    clean = re.sub(r'\s+', ' ', clean).strip()

    connectives = {'DE', 'DA', 'DO', 'DAS', 'DOS', 'E'}
    tokens = clean.split()
    sig_tokens = [t for t in tokens if t not in connectives]
    if not sig_tokens:
        sig_tokens = tokens
    return clean, sig_tokens

def normalize_email_local(email):
    if not email or '@' not in email:
        return ''
    local = email.split('@', 1)[0]
    nfd = unicodedata.normalize('NFD', local)
    no_accents = ''.join(c for c in nfd if unicodedata.category(c) != 'Mn').upper()
    letters_only = re.sub(r'[^A-Z]', '', no_accents)
    return letters_only

def check_email_confirms_surname(email, supa_tokens, cand_tokens):
    """Verifica se o e-mail contem (como substring) algum token do nome da lista
    que NAO aparece no nome cadastrado no Supabase. Isso ajuda a confirmar (ou
    contestar) matches fracos, tipicamente quando o nome no Supabase esta
    incompleto (ex: so o primeiro nome)."""
    extra_tokens = [t for t in cand_tokens if t not in set(supa_tokens) and len(t) >= 3]
    if not extra_tokens:
        return 'N/A'

    email_norm = normalize_email_local(email)
    if not email_norm:
        return 'SEM_EMAIL'

    for t in extra_tokens:
        if t in email_norm:
            return 'SIM'
    return 'NAO'

def format_phone(user):
    phone = (user.get('phone') or '').strip()
    meta = user.get('metadata') or {}
    meta_num = str(meta.get('phone_number') or '').strip()
    meta_ddd = str(meta.get('phone_local_code') or '').strip()

    raw_phone = phone
    if not raw_phone and meta_num:
        if meta_ddd and meta_ddd != '55':
            raw_phone = f"{meta_ddd}{meta_num}"
        else:
            raw_phone = meta_num

    if not raw_phone:
        return ''

    digits = re.sub(r'\D', '', raw_phone)
    if digits.startswith('55') and len(digits) in (12, 13):
        digits = digits[2:]

    if len(digits) == 11:
        return f"({digits[:2]}) {digits[2:7]}-{digits[7:]}"
    elif len(digits) == 10:
        return f"({digits[:2]}) {digits[6:]}"
    else:
        return digits if digits else raw_phone

def calculate_match(supa_norm, supa_tokens, cand_norm, cand_tokens):
    if not supa_norm or not cand_norm:
        return 0.0, 'none'

    # 1. Match Perfeito Exato (1.0)
    if supa_norm == cand_norm:
        return 1.0, 'exact_match'

    set_supa = set(supa_tokens)
    set_cand = set(cand_tokens)

    # 2. Match Perfeito com Tokens Reordenados (1.0)
    if sorted(supa_tokens) == sorted(cand_tokens):
        return 1.0, 'exact_reordered'

    # REGRA RIGOROSA:
    # Permitido a lista de aprovados ter sobrenomes a mais.
    # NÃO é permitido o banco Supabase ter sobrenomes/palavras a mais.

    # Caso 1: Todos os tokens do Supabase estão contidos na lista (O(1))
    if set_supa.issubset(set_cand):
        matched_cand_tokens = set_supa
    else:
        # Caso 2: Verificar se os tokens que faltam são erros de digitação (fuzzy)
        matched_cand_tokens = set_supa.intersection(set_cand)
        unmatched_supa = set_supa - matched_cand_tokens
        cand_available = set(set_cand - matched_cand_tokens)

        for t_s in unmatched_supa:
            found_match = False
            if len(t_s) == 1:
                for t_c in cand_available:
                    if t_c.startswith(t_s):
                        found_match = True
                        matched_cand_tokens.add(t_c)
                        cand_available.remove(t_c)
                        break
            else:
                for t_c in cand_available:
                    if abs(len(t_s) - len(t_c)) <= 2:
                        if difflib.SequenceMatcher(None, t_s, t_c).ratio() >= 0.80:
                            found_match = True
                            matched_cand_tokens.add(t_c)
                            cand_available.remove(t_c)
                            break
            if not found_match:
                # Se tem um sobrenome/palavra no Supabase sem correspondente na lista -> REJEITA!
                return 0.0, 'extra_surname_in_bank'

    # Se todos os tokens do Supabase foram pareados com tokens da lista:
    coverage = len(matched_cand_tokens) / len(cand_tokens)

    if supa_norm in cand_norm:
        score = round(0.92 + 0.08 * coverage, 4)
        match_type = 'contained_substring'
    else:
        score = round(0.85 + 0.12 * coverage, 4)
        match_type = 'contained_tokens'

    return score, match_type

def fetch_supabase_table(url, key, endpoint):
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json'
    }
    all_rows = []
    limit = 1000
    offset = 0
    while True:
        sep = '&' if '?' in endpoint else '?'
        req_url = f'{url}/rest/v1/{endpoint}{sep}limit={limit}&offset={offset}'
        req = urllib.request.Request(req_url, headers=headers)
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            if not data:
                break
            all_rows.extend(data)
            offset += len(data)
            if len(data) < limit:
                break
    return all_rows

def load_env():
    env = {}
    with open('.env') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip().strip('\"\'')
    return env

def run_match(list_label, input_json, all_users, user_memberships, plan_names):
    print(f"\n{'='*70}")
    print(f"Processando lista: {list_label} ({input_json})")
    print(f"{'='*70}")

    with open(input_json, 'r', encoding='utf-8') as f:
        candidatos = json.load(f)
    print(f"   Total de candidatos na lista: {len(candidatos)}")

    # Pre-normalizar candidatos e criar índices por token
    cands_processed = []
    cand_by_exact = {}
    cand_by_sorted = {}
    inverted_token_index = {}

    for idx, c in enumerate(candidatos):
        nome_raw = c.get('nome', '')
        cand_norm, cand_tokens = normalize_name(nome_raw)
        cand_item = {
            'index': idx,
            'data': c,
            'norm': cand_norm,
            'tokens': cand_tokens,
            'sorted_str': ' '.join(sorted(cand_tokens)),
            'set_tokens': set(cand_tokens)
        }
        cands_processed.append(cand_item)

        if cand_norm not in cand_by_exact:
            cand_by_exact[cand_norm] = cand_item
        if cand_item['sorted_str'] not in cand_by_sorted:
            cand_by_sorted[cand_item['sorted_str']] = cand_item

        for t in cand_tokens:
            if len(t) >= 3:
                if t not in inverted_token_index:
                    inverted_token_index[t] = []
                inverted_token_index[t].append(idx)

    print(f"   Executando correspondência com regra estrita...")
    t0 = time.time()

    results = []
    rejected_low_confidence = []
    exact_matches_count = 0
    reordered_matches_count = 0
    contained_matches_count = 0
    com_assinatura_ativa_count = 0
    com_telefone_count = 0

    for user in all_users:
        supa_name = user.get('full_name') or ''
        supa_norm, supa_tokens = normalize_name(supa_name)

        if not supa_norm or not supa_tokens:
            continue

        best_cand = None
        best_score = 0.0
        best_type = 'none'

        # Match idêntico exato (1.0)
        if supa_norm in cand_by_exact:
            cand_item = cand_by_exact[supa_norm]
            best_cand = cand_item['data']
            best_score = 1.0
            best_type = 'exact_match'
        else:
            supa_sorted_str = ' '.join(sorted(supa_tokens))
            # Match idêntico reordenado (1.0)
            if supa_sorted_str in cand_by_sorted:
                cand_item = cand_by_sorted[supa_sorted_str]
                best_cand = cand_item['data']
                best_score = 1.0
                best_type = 'exact_reordered'
            else:
                candidate_pool_idx = set()
                for t in supa_tokens:
                    if len(t) >= 3 and t in inverted_token_index:
                        candidate_pool_idx.update(inverted_token_index[t])

                for cand_idx in candidate_pool_idx:
                    cand_item = cands_processed[cand_idx]
                    score, match_type = calculate_match(
                        supa_norm, supa_tokens,
                        cand_item['norm'], cand_item['tokens']
                    )
                    if score > best_score:
                        best_score = score
                        best_cand = cand_item['data']
                        best_type = match_type
                        if best_score == 1.0:
                            break

        # Filtrar apenas correspondências válidas (score >= 0.70)
        if best_cand and best_score >= 0.70:
            _, best_cand_tokens = normalize_name(best_cand.get('nome', ''))
            email_check = check_email_confirms_surname(user.get('email'), supa_tokens, best_cand_tokens)

            # REGRA DE SEGURANÇA: se o nome no Supabase tem só 1 token
            # significativo (ex: nome incompleto tipo "Murilo" ou "da motta"
            # após remover conectivos), o match é muito fraco — só um
            # primeiro nome/sobrenome comum pode coincidir com qualquer
            # candidato. Nesse caso, só aceitamos o match se o e-mail
            # confirmar algum outro token do nome da lista.
            if len(supa_tokens) <= 1 and email_check != 'SIM':
                rejected_low_confidence.append({
                    'supabase_user_id': user.get('id'),
                    'supabase_full_name': supa_name,
                    'supabase_email': user.get('email'),
                    'candidato_nome_lista': best_cand.get('nome'),
                    'fuzzy_score': best_score,
                    'match_type': best_type,
                    'email_confirma_sobrenome': email_check,
                    'motivo_rejeicao': 'nome_supabase_com_1_token_e_email_nao_confirma'
                })
                continue

            uid = user.get('id')
            m_list = user_memberships.get(uid, [])

            active_m = [m for m in m_list if m.get('status') == 'active']
            has_active = len(active_m) > 0
            if has_active:
                com_assinatura_ativa_count += 1

            active_plan_names = [plan_names.get(m.get('membership_level_id'), f"Plano {m.get('membership_level_id')}") for m in active_m]
            all_statuses = sorted(list(set(m.get('status') for m in m_list))) if m_list else ['sem_assinatura']

            phone_formatted = format_phone(user)
            if phone_formatted:
                com_telefone_count += 1

            if best_type == 'exact_match':
                exact_matches_count += 1
            elif best_type == 'exact_reordered':
                reordered_matches_count += 1
            else:
                contained_matches_count += 1

            results.append({
                'supabase_user_id': uid,
                'supabase_mk_id': user.get('mk_id'),
                'supabase_full_name': supa_name,
                'supabase_email': user.get('email'),
                'supabase_celular': phone_formatted,
                'tem_assinatura_ativa': 'SIM' if has_active else 'NÃO',
                'planos_ativos': ', '.join(active_plan_names) if active_plan_names else 'Nenhum',
                'status_assinaturas': ', '.join(all_statuses),
                'candidato_lista': list_label,
                'candidato_nome_lista': best_cand.get('nome'),
                'candidato_numero_inscricao': best_cand.get('numero_inscricao'),
                'candidato_classificacao': best_cand.get('classificacao'),
                'candidato_oed': best_cand.get('oed'),
                'candidato_gi': best_cand.get('GI'),
                'candidato_data_nascimento': best_cand.get('data_nascimento'),
                'fuzzy_score': best_score,
                'match_type': best_type,
                'email_confirma_sobrenome': email_check
            })

    t1 = time.time()
    print(f"\n=== RESULTADOS DO FUZZY MATCHING ({list_label} x Supabase) ===")
    print(f"Tempo de execução: {t1-t0:.2f} segundos")
    print(f"Total de correspondências válidas (fuzzy_score >= 0.70): {len(results)}")
    print(f"  - Usuários com CELULAR / TELEFONE cadastrado: {com_telefone_count}")
    print(f"  - Aprovados com ASSINATURA ATIVA: {com_assinatura_ativa_count}")
    print(f"  - Aprovados SEM ASSINATURA ATIVA: {len(results) - com_assinatura_ativa_count}")
    print(f"\nDetalhamento por tipo de Match:")
    print(f"  - Matchs Perfeitos Idênticos (1.0): {exact_matches_count}")
    print(f"  - Matchs Perfeitos Reordenados/Sem Conectivos (1.0): {reordered_matches_count}")
    print(f"  - Matchs Parciais (Nome do Supabase totalmente contido na lista): {contained_matches_count}")
    print(f"  - Rejeitados por baixa confiança (nome de 1 token + e-mail não confirma): {len(rejected_low_confidence)}")

    results.sort(key=lambda x: x['fuzzy_score'], reverse=True)

    output_json = f'resultado_fuzzy_{list_label.lower()}_supabase.json'
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nArquivo JSON salvo com sucesso: {output_json}")

    output_csv = f'resultado_fuzzy_{list_label.lower()}_supabase.csv'
    if results:
        keys = list(results[0].keys())
        with open(output_csv, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(results)
        print(f"Arquivo CSV salvo com sucesso: {output_csv}")

    if rejected_low_confidence:
        rejected_json = f'rejeitados_baixa_confianca_{list_label.lower()}_supabase.json'
        with open(rejected_json, 'w', encoding='utf-8') as f:
            json.dump(rejected_low_confidence, f, ensure_ascii=False, indent=2)
        print(f"Arquivo de rejeitados (revisão manual) salvo: {rejected_json}")

    return results

def main():
    print("Conectando ao Supabase para puxar Usuários (com Celular), Planos e Assinaturas...")
    env = load_env()
    url = env['SUPABASE_URL']
    key = env['SUPABASE_SERVICE_ROLE_KEY']

    all_users = fetch_supabase_table(url, key, 'users?select=id,mk_id,full_name,email,phone,metadata,created_at')
    print(f"   Usuários baixados: {len(all_users)}")

    plans_data = fetch_supabase_table(url, key, 'membership_levels?select=id,name')
    plan_names = {p['id']: p['name'] for p in plans_data}

    memberships_data = fetch_supabase_table(url, key, 'memberships?select=user_id,membership_level_id,status,expire_date')

    user_memberships = {}
    for m in memberships_data:
        uid = m.get('user_id')
        if not uid:
            continue
        if uid not in user_memberships:
            user_memberships[uid] = []
        user_memberships[uid].append(m)

    run_match('CIAGA', 'CIAGA_candidatos.json', all_users, user_memberships, plan_names)
    run_match('CIABA', 'CIABA_candidatos.json', all_users, user_memberships, plan_names)

if __name__ == '__main__':
    main()
