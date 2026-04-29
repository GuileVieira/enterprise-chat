#!/bin/bash
set -e
export LC_ALL=en_US.UTF-8

cd /Users/guilherme/Projetos/LibreChat/sites/orqest-landing/src

FILES=(
  "components/sections/Hero.tsx"
  "components/sections/Problem.tsx"
  "components/sections/FalseHope.tsx"
  "components/sections/Solution.tsx"
  "components/sections/AgentsBento.tsx"
  "components/sections/HowItWorks.tsx"
  "components/sections/Proof.tsx"
  "components/sections/WhoIsFor.tsx"
  "components/sections/FAQ.tsx"
  "components/sections/Closing.tsx"
  "components/sections/Footer.tsx"
  "components/ui/GlassNav.tsx"
  "components/ui/QualificationModal.tsx"
  "components/ui/AgentSimulation.tsx"
  "components/ui/AgentCard.tsx"
  "hooks/useQualification.ts"
  "app/obrigado/page.tsx"
  "app/layout.tsx"
)

# Combined regex for counting
COUNT_RE='\b(nao|Nao|operacao|operacoes|agencia|agencias|voce|Voce|entregaveis|publico-alvo|metricas|relatorios|logica|padrao|genericos|genericas|padronizacao|criacao|producao|duracao|sugestoes|conteudo|mes|angulo|estagiario|instantaneas|instantaneos|ate|organizacao|formatacao|configuracao|comunicacoes|estrategia|inconsistencia|historicos|negocio|integracoes|necessario|adocao|revisao|comecar|manha|memoria|diagnosticos|apresentacao|lideranca|voces|baguncada|estagio|otimo|Concluido|reuniao|Ja)\b'

# Combined perl expression for replacement
PERL_EXPR=$(cat <<'EOF'
s/\bnao\b/não/g;
s/\bNao\b/Não/g;
s/\boperacao\b/operação/g;
s/\boperacoes\b/operações/g;
s/\bagencia\b/agência/g;
s/\bagencias\b/agências/g;
s/\bvoce\b/você/g;
s/\bVoce\b/Você/g;
s/\bentregaveis\b/entregáveis/g;
s/\bpublico-alvo\b/público-alvo/g;
s/\bmetricas\b/métricas/g;
s/\brelatorios\b/relatórios/g;
s/\blogica\b/lógica/g;
s/\bpadrao\b/padrão/g;
s/\bgenericos\b/genéricos/g;
s/\bgenericas\b/genéricas/g;
s/\bpadronizacao\b/padronização/g;
s/\bcriacao\b/criação/g;
s/\bproducao\b/produção/g;
s/\bduracao\b/duração/g;
s/\bsugestoes\b/sugestões/g;
s/\bconteudo\b/conteúdo/g;
s/\bmes\b/mês/g;
s/\bangulo\b/ângulo/g;
s/\bestagiario\b/estagiário/g;
s/\binstantaneas\b/instantâneas/g;
s/\binstantaneos\b/instantâneos/g;
s/\bate\b/até/g;
s/\borganizacao\b/organização/g;
s/\bformatacao\b/formatação/g;
s/\bconfiguracao\b/configuração/g;
s/\bcomunicacoes\b/comunicações/g;
s/\bestrategia\b/estratégia/g;
s/\binconsistencia\b/inconsistência/g;
s/\bhistoricos\b/históricos/g;
s/\bnegocio\b/negócio/g;
s/\bintegracoes\b/integrações/g;
s/\bnecessario\b/necessário/g;
s/\badocao\b/adoção/g;
s/\brevisao\b/revisão/g;
s/\bcomecar\b/começar/g;
s/\bmanha\b/manhã/g;
s/\bmemoria\b/memória/g;
s/\bdiagnosticos\b/diagnósticos/g;
s/\bapresentacao\b/apresentação/g;
s/\blideranca\b/liderança/g;
s/\bvoces\b/vocês/g;
s/\bbaguncada\b/bagunçada/g;
s/\bestagio\b/estágio/g;
s/\botimo\b/ótimo/g;
s/\bConcluido\b/Concluído/g;
s/\breuniao\b/reunião/g;
s/\bJa\b/Já/g
EOF
)

for file in "${FILES[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "SKIP (not found): $file"
    continue
  fi

  count=$(grep -o -E "$COUNT_RE" "$file" | wc -l | tr -d ' ')
  if [[ "$count" -gt 0 ]]; then
    perl -CSD -pi -e "$PERL_EXPR" "$file"
    echo "$file: $count replacements"
  else
    echo "$file: 0 replacements"
  fi
done
