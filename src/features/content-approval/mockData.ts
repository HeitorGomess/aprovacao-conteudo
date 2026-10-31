import type { Content, ContentStatus } from './types';

function dateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createContent(
  id: string,
  title: string,
  daysFromNow: number,
  channel: string,
  format: string,
  status: ContentStatus,
  caption: string,
  note: string,
): Content {
  const updatedAt = new Date().toISOString();
  return {
    id,
    title,
    date: dateOffset(daysFromNow),
    channel,
    format,
    link: '',
    caption,
    note,
    status,
    coverData: '',
    history: [{ status, at: updatedAt }],
    updatedAt,
  };
}

export function createMockContents(): Content[] {
  return [
    createContent(
      'demo-1',
      'Checklist para organizar o financeiro do mês',
      -8,
      'Instagram',
      'Carrossel',
      'aprovado',
      'Uma rotina simples ajuda a acompanhar entradas, saídas e compromissos da empresa.',
      'Revisar a última lâmina antes de publicar.',
    ),
    createContent(
      'demo-2',
      'O que observar antes de fechar o caixa',
      -5,
      'LinkedIn',
      'Feed',
      'aprovado',
      'Conferir os números com frequência facilita decisões e evita surpresas no fim do mês.',
      '',
    ),
    createContent(
      'demo-3',
      'Mitos e verdades sobre planejamento tributário',
      -2,
      'Instagram',
      'Reels',
      'revisao',
      'Planejamento também é organização: cada empresa tem uma realidade e precisa de orientação adequada.',
      'Aguardar validação do time contábil.',
    ),
    createContent(
      'demo-4',
      'Como preparar documentos para a contabilidade',
      0,
      'Instagram',
      'Stories',
      'ajustes',
      'Separar documentos ao longo do mês deixa a rotina mais leve para todo mundo.',
      'Adicionar exemplo de organização por categoria.',
    ),
    createContent(
      'demo-5',
      'Indicadores financeiros que ajudam na tomada de decisão',
      2,
      'LinkedIn',
      'Carrossel',
      'rascunho',
      'Uma visão clara dos indicadores pode apoiar escolhas mais conscientes no negócio.',
      '',
    ),
    createContent(
      'demo-6',
      'Perguntas frequentes sobre fluxo de caixa',
      4,
      'Blog',
      'Artigo',
      'revisao',
      'Um guia introdutório para entender o acompanhamento do fluxo de caixa no dia a dia.',
      'Conferir título e descrição para busca.',
    ),
    createContent(
      'demo-7',
      'Dica rápida: reserve um momento para conferir seus números',
      8,
      'Instagram',
      'Feed',
      'rascunho',
      'Um pequeno hábito semanal pode ajudar a manter as informações financeiras organizadas.',
      '',
    ),
    createContent(
      'demo-8',
      'Bastidores: rotina de atendimento da equipe',
      11,
      'YouTube',
      'Vídeo',
      'revisao',
      'Apresentar a equipe e explicar como funciona o primeiro atendimento.',
      'Definir data de gravação.',
    ),
  ];
}
