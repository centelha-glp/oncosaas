import React from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Termos de Serviço — OncoNav',
  description:
    'Termos de Serviço da plataforma OncoNav. Condições de uso, responsabilidades, SLA e obrigações legais.',
};

const toc = [
  { id: 'definicoes', label: '1. Definições' },
  { id: 'objeto', label: '2. Objeto' },
  { id: 'cadastro', label: '3. Cadastro e Acesso' },
  { id: 'obrigacoes-usuario', label: '4. Obrigações do Usuário' },
  { id: 'obrigacoes-onconav', label: '5. Obrigações da OncoNav' },
  { id: 'ia', label: '6. Uso de Inteligência Artificial' },
  { id: 'sla', label: '7. Disponibilidade e SLA' },
  { id: 'propriedade', label: '8. Propriedade Intelectual' },
  { id: 'pagamento', label: '9. Pagamento e Planos' },
  { id: 'responsabilidades', label: '10. Limitação de Responsabilidade' },
  { id: 'rescisao', label: '11. Rescisão' },
  { id: 'lgpd', label: '12. Proteção de Dados (LGPD)' },
  { id: 'disposicoes', label: '13. Disposições Gerais' },
  { id: 'contato-termos', label: '14. Contato' },
];

export default function TermosPage() {
  return (
    <div className="pt-24 pb-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Cabeçalho */}
        <div className="mb-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200">
            <FileText className="h-7 w-7 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Termos de Serviço
          </h1>
          <p className="mt-3 text-muted-foreground">
            Última atualização: 5 de março de 2026
          </p>
        </div>

        <div className="grid gap-12 lg:grid-cols-[240px_1fr]">
          {/* Table of Contents */}
          <aside className="hidden lg:block">
            <nav className="sticky top-24">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nesta página
              </h2>
              <ul className="space-y-1.5 border-l border-border pl-4">
                {toc.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-0.5"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Conteúdo */}
          <article className="prose-legal">
            <section id="definicoes">
              <h2>1. Definições</h2>
              <p>Para os fins destes Termos de Serviço:</p>
              <ul>
                <li>
                  <strong>Plataforma:</strong> O software SaaS OncoNav,
                  incluindo todas as funcionalidades, módulos e integrações.
                </li>
                <li>
                  <strong>Contratante:</strong> A instituição de saúde
                  (hospital, clínica, centro oncológico) que contrata o serviço.
                </li>
                <li>
                  <strong>Usuário:</strong> O profissional de saúde que utiliza a
                  plataforma (oncologista, enfermeiro, navegador, coordenador).
                </li>
                <li>
                  <strong>Paciente:</strong> A pessoa física cujos dados
                  clínicos são processados pela plataforma.
                </li>
                <li>
                  <strong>Tenant:</strong> O ambiente isolado de cada
                  instituição contratante dentro da plataforma.
                </li>
                <li>
                  <strong>Agente IA:</strong> O sistema de inteligência
                  artificial integrado à plataforma para priorização, sugestões
                  e comunicação.
                </li>
              </ul>
            </section>

            <section id="objeto">
              <h2>2. Objeto</h2>
              <p>
                A OncoNav disponibiliza uma plataforma SaaS de navegação
                oncológica que inclui:
              </p>
              <ul>
                <li>
                  Dashboard inteligente para acompanhamento de pacientes
                  oncológicos
                </li>
                <li>
                  Protocolos de navegação automatizados por tipo de câncer
                </li>
                <li>
                  Sistema de alertas em tempo real para etapas atrasadas ou
                  pendentes
                </li>
                <li>
                  Agente conversacional via WhatsApp Business API com
                  inteligência artificial
                </li>
                <li>
                  Priorização de pacientes por algoritmos de machine learning
                </li>
                <li>
                  Integração com sistemas hospitalares via padrões FHIR/HL7
                </li>
                <li>
                  Módulo de auditoria e compliance (LGPD, CFM)
                </li>
              </ul>
            </section>

            <section id="cadastro">
              <h2>3. Cadastro e Acesso</h2>
              <h3>3.1 Registro da Instituição</h3>
              <p>
                O acesso à plataforma requer o cadastro da instituição de saúde,
                com validação de dados e aceite destes Termos. A instituição é
                responsável pela veracidade das informações fornecidas.
              </p>

              <h3>3.2 Contas de Usuário</h3>
              <p>
                Cada profissional recebe uma conta individual com credenciais
                pessoais e intransferíveis. O usuário é responsável pela
                segurança de suas credenciais e por todas as ações realizadas
                com sua conta.
              </p>

              <h3>3.3 Papéis e Permissões</h3>
              <p>
                A plataforma implementa controle de acesso baseado em funções
                (RBAC). Os papéis disponíveis incluem: Administrador,
                Oncologista, Enfermeiro e Coordenador, cada um com permissões
                específicas definidas pelo administrador da instituição.
              </p>
            </section>

            <section id="obrigacoes-usuario">
              <h2>4. Obrigações do Usuário</h2>
              <p>O Contratante e seus Usuários se comprometem a:</p>
              <ol>
                <li>
                  Utilizar a plataforma exclusivamente para fins de navegação
                  oncológica e gestão de pacientes.
                </li>
                <li>
                  Manter suas credenciais de acesso em sigilo, não
                  compartilhando com terceiros.
                </li>
                <li>
                  Inserir dados verdadeiros, completos e atualizados dos
                  pacientes.
                </li>
                <li>
                  Respeitar as regulamentações do CFM, ANVISA e demais órgãos
                  competentes.
                </li>
                <li>
                  Obter o consentimento dos pacientes quando necessário conforme
                  a LGPD.
                </li>
                <li>
                  Não utilizar a plataforma para atividades ilegais,
                  fraudulentas ou que violem direitos de terceiros.
                </li>
                <li>
                  Não tentar acessar dados de outros tenants ou contornar
                  mecanismos de segurança.
                </li>
                <li>
                  Comunicar imediatamente qualquer uso não autorizado ou
                  suspeita de violação de segurança.
                </li>
              </ol>
            </section>

            <section id="obrigacoes-onconav">
              <h2>5. Obrigações da OncoNav</h2>
              <p>A OncoNav se compromete a:</p>
              <ol>
                <li>
                  Fornecer a plataforma com a funcionalidade descrita e manter
                  disponibilidade conforme o SLA contratado.
                </li>
                <li>
                  Implementar e manter medidas de segurança adequadas para
                  proteção de dados.
                </li>
                <li>
                  Garantir o isolamento completo de dados entre instituições
                  (multi-tenancy).
                </li>
                <li>
                  Realizar backups automáticos e disponibilizar plano de
                  recuperação de desastres.
                </li>
                <li>
                  Comunicar incidentes de segurança conforme prazos da LGPD.
                </li>
                <li>
                  Oferecer suporte técnico conforme o plano contratado.
                </li>
                <li>
                  Manter protocolos clínicos atualizados conforme guidelines
                  médicos vigentes.
                </li>
              </ol>
            </section>

            <section id="ia">
              <h2>6. Uso de Inteligência Artificial</h2>
              <h3>6.1 Natureza das Recomendações</h3>
              <p>
                As análises, priorizações e sugestões geradas pela inteligência
                artificial da plataforma são <strong>ferramentas de apoio</strong>{' '}
                à decisão clínica e <strong>não substituem</strong> o julgamento
                profissional do médico ou equipe de saúde.
              </p>

              <h3>6.2 Responsabilidade Clínica</h3>
              <p>
                A responsabilidade por decisões clínicas permanece integralmente
                com o profissional de saúde responsável. A OncoNav não se
                responsabiliza por decisões clínicas tomadas com base nas
                sugestões da IA.
              </p>

              <h3>6.3 Transparência</h3>
              <p>
                Quando a plataforma utiliza IA para gerar recomendações, isso é
                claramente indicado na interface. Os modelos de IA são
                desenvolvidos com base em guidelines médicos reconhecidos
                (NCCN, ESMO, SBOC).
              </p>

              <h3>6.4 Agente Conversacional</h3>
              <p>
                O agente via WhatsApp opera com guardrails de segurança,
                incluindo encaminhamento automático para profissionais humanos em
                situações que requerem avaliação médica imediata.
              </p>
            </section>

            <section id="sla">
              <h2>7. Disponibilidade e SLA</h2>
              <h3>7.1 Disponibilidade</h3>
              <p>
                A OncoNav se compromete com uma disponibilidade de{' '}
                <strong>99.9%</strong> (uptime), excluindo manutenções
                programadas e eventos de força maior.
              </p>

              <h3>7.2 Manutenções Programadas</h3>
              <p>
                Manutenções programadas serão comunicadas com antecedência
                mínima de 48 horas e realizadas preferencialmente fora do
                horário comercial.
              </p>

              <h3>7.3 Suporte Técnico</h3>
              <p>
                O suporte técnico é oferecido conforme o plano contratado,
                podendo incluir:
              </p>
              <ul>
                <li>
                  <strong>Plano Básico:</strong> Suporte por e-mail em horário
                  comercial (resposta em até 24h úteis).
                </li>
                <li>
                  <strong>Plano Profissional:</strong> Suporte por e-mail e chat
                  em horário estendido (resposta em até 8h úteis).
                </li>
                <li>
                  <strong>Plano Enterprise:</strong> Suporte 24/7 por e-mail,
                  chat e telefone com gerente de conta dedicado.
                </li>
              </ul>
            </section>

            <section id="propriedade">
              <h2>8. Propriedade Intelectual</h2>
              <p>
                A OncoNav detém todos os direitos de propriedade intelectual
                sobre a plataforma, incluindo código-fonte, design, algoritmos
                de IA, marcas e documentação.
              </p>
              <p>
                O Contratante possui a propriedade dos dados inseridos na
                plataforma. A OncoNav não adquire direitos sobre os dados
                clínicos dos pacientes, exceto os direitos necessários para a
                prestação do serviço.
              </p>
            </section>

            <section id="pagamento">
              <h2>9. Pagamento e Planos</h2>
              <h3>9.1 Assinatura</h3>
              <p>
                O acesso à plataforma é oferecido por assinatura mensal ou
                anual, conforme o plano contratado. Os valores estão sujeitos a
                reajustes anuais com comunicação prévia de 30 dias.
              </p>

              <h3>9.2 Cobrança</h3>
              <p>
                A cobrança é realizada automaticamente na data de renovação via
                cartão de crédito, boleto bancário ou PIX. O não pagamento por
                mais de 15 dias pode resultar na suspensão do acesso.
              </p>

              <h3>9.3 Reembolso</h3>
              <p>
                No plano anual, é oferecido reembolso proporcional nos primeiros
                30 dias (garantia de satisfação). Após este período, não são
                concedidos reembolsos, mas o serviço permanece ativo até o fim
                do período contratado.
              </p>
            </section>

            <section id="responsabilidades">
              <h2>10. Limitação de Responsabilidade</h2>
              <p>
                A OncoNav <strong>não se responsabiliza por</strong>:
              </p>
              <ul>
                <li>
                  Decisões clínicas tomadas por profissionais de saúde, ainda
                  que informadas por dados ou sugestões da plataforma.
                </li>
                <li>
                  Danos decorrentes de uso indevido da plataforma ou violação
                  destes Termos pelo Contratante ou seus Usuários.
                </li>
                <li>
                  Indisponibilidade causada por fatores fora de seu controle
                  (força maior, falhas de internet, desastres naturais).
                </li>
                <li>
                  Dados inseridos de forma incorreta, incompleta ou
                  desatualizada pelos Usuários.
                </li>
              </ul>
              <p>
                Em nenhuma hipótese a responsabilidade total da OncoNav
                excederá o valor pago pelo Contratante nos últimos 12 meses de
                serviço.
              </p>
            </section>

            <section id="rescisao">
              <h2>11. Rescisão</h2>
              <h3>11.1 Pelo Contratante</h3>
              <p>
                O Contratante pode rescindir a qualquer momento, com aviso
                prévio de 30 dias. Após a rescisão, os dados podem ser
                exportados em formato compatível (JSON/CSV/FHIR) por até 90
                dias.
              </p>

              <h3>11.2 Pela OncoNav</h3>
              <p>A OncoNav pode rescindir ou suspender o acesso em caso de:</p>
              <ul>
                <li>Violação destes Termos de Serviço.</li>
                <li>
                  Inadimplência por período superior a 30 dias consecutivos.
                </li>
                <li>
                  Uso da plataforma para atividades ilegais ou fraudulentas.
                </li>
                <li>
                  Tentativas de comprometer a segurança ou acessar dados de
                  outros tenants.
                </li>
              </ul>

              <h3>11.3 Portabilidade de Dados</h3>
              <p>
                Em caso de rescisão, o Contratante tem direito à exportação
                integral dos seus dados em formato estruturado e
                interoperável, conforme garantido pela LGPD.
              </p>
            </section>

            <section id="lgpd">
              <h2>12. Proteção de Dados (LGPD)</h2>
              <p>
                O tratamento de dados pessoais segue as diretrizes da LGPD (Lei
                n.º 13.709/2018). Para informações detalhadas sobre coleta,
                uso, armazenamento e proteção de dados, consulte nossa{' '}
                <Link
                  href="/privacidade"
                  className="underline hover:text-sky-600 transition-colors"
                >
                  Política de Privacidade
                </Link>
                .
              </p>
              <p>
                A OncoNav atua como <strong>Operadora de dados</strong> em
                relação aos dados clínicos dos pacientes. A instituição de saúde
                contratante atua como <strong>Controladora</strong>.
              </p>
            </section>

            <section id="disposicoes">
              <h2>13. Disposições Gerais</h2>
              <h3>13.1 Legislação Aplicável</h3>
              <p>
                Estes Termos são regidos pelas leis da República Federativa do
                Brasil, em especial a LGPD, o Código de Defesa do Consumidor e
                o Marco Civil da Internet.
              </p>

              <h3>13.2 Foro</h3>
              <p>
                Fica eleito o foro da comarca de Vitória, ES, para dirimir
                quaisquer litígios decorrentes destes Termos, com renúncia a
                qualquer outro, por mais privilegiado que seja.
              </p>

              <h3>13.3 Independência das Cláusulas</h3>
              <p>
                Se qualquer cláusula destes Termos for considerada inválida ou
                inexequível, as demais cláusulas permanecerão em pleno vigor e
                efeito.
              </p>

              <h3>13.4 Alterações</h3>
              <p>
                A OncoNav reserva-se o direito de modificar estes Termos a
                qualquer momento. Alterações significativas serão comunicadas com
                antecedência mínima de 30 dias. O uso continuado da plataforma
                após a comunicação constitui aceite dos novos termos.
              </p>
            </section>

            <section id="contato-termos">
              <h2>14. Contato</h2>
              <p>
                Para dúvidas sobre estes Termos de Serviço:
              </p>
              <ul>
                <li>
                  <strong>E-mail jurídico:</strong> juridico@onconav.com.br
                </li>
                <li>
                  <strong>E-mail geral:</strong> contato@onconav.com.br
                </li>
                <li>
                  <strong>Telefone:</strong> (27) 99999-0000
                </li>
                <li>
                  <strong>Endereço:</strong> Vitória, ES — Brasil
                </li>
              </ul>
            </section>

            <div className="mt-12 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
              <p className="text-sm text-emerald-800">
                <strong>Nota:</strong> Ao utilizar a plataforma OncoNav, você
                declara ter lido e aceito integralmente estes Termos de Serviço
                e nossa{' '}
                <Link
                  href="/privacidade"
                  className="underline hover:text-emerald-600 transition-colors"
                >
                  Política de Privacidade
                </Link>
                .
              </p>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
