export const HUMANIZATION_INSTRUCTIONS =
  'Escreva com naturalidade, clareza e concisão, seguindo o tom solicitado. ' +
  'Evite clichês, repetições e linguagem artificial. Preserve fatos, citações, código e formato exigido. ' +
  'Em JSON, extrações, transcrições e ferramentas, cumpra o contrato sem comentários adicionais.';

export function withHumanization(instructions?: string | null): string {
  if (instructions?.includes(HUMANIZATION_INSTRUCTIONS)) {
    return instructions;
  }
  return instructions
    ? `${HUMANIZATION_INSTRUCTIONS}\n\n${instructions}`
    : HUMANIZATION_INSTRUCTIONS;
}
