import React from 'react';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidade — OncoNav',
  description:
    'Política de Privacidade da plataforma OncoNav. Saiba como tratamos e protegemos seus dados pessoais e de saúde conforme a LGPD.',
};

const toc = [
  { id: 'introducao', label: '1. Introdução' },
  { id: 'dados-coletados', label: '2. Dados Coletados' },
  { id: 'finalidade', label: '3. Finalidade do Tratamento' },
  { id: 'base-legal', label: '4. Base Legal' },
  { id: 'compartilhamento', label: '5. Compartilhamento de Dados' },
  { id: 'seguranca', label: '6. Segurança dos Dados' },
  { id: 'retencao', label: '7. Retenção de Dados' },
  { id: 'direitos', label: '8. Seus Direitos (LGPD)' },
  { id: 'cookies', label: '9. Cookies' },
  { id: 'menores', label: '10. Menores de Idade' },
  { id: 'alteracoes', label: '11. Alterações nesta Política' },
  { id: 'contato', label: '12. Contato e DPO' },
];

export default function PrivacidadePage() {
  return (
    <div className="pt-24 pb-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Cabeçalho */}
        <div className="mb-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 border border-sky-200">
            <Shield className="h-7 w-7 text-sky-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Política de Privacidade
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
            <section id="introducao">
              <h2>1. Introdução</h2>
              <p>
                A <strong>OncoNav</strong> (&ldquo;nós&rdquo;,
                &ldquo;nosso&rdquo; ou &ldquo;Plataforma&rdquo;) é uma
                plataforma SaaS de navegação oncológica que tem como compromisso
                a proteção dos dados pessoais dos seus usuários e pacientes.
              </p>
              <p>
                Esta Política de Privacidade descreve como coletamos, usamos,
                armazenamos, compartilhamos e protegemos as informações pessoais
                e dados de saúde processados por nossa plataforma, em
                conformidade com a{' '}
                <strong>
                  Lei Geral de Proteção de Dados (LGPD — Lei n.º 13.709/2018)
                </strong>
                .
              </p>
              <p>
                Ao utilizar a Plataforma, você reconhece que leu e compreendeu
                esta Política de Privacidade e concorda com o tratamento dos
                seus dados conforme aqui descrito.
              </p>
            </section>

            <section id="dados-coletados">
              <h2>2. Dados Coletados</h2>
              <h3>2.1 Dados dos Profissionais de Saúde (Usuários)</h3>
              <ul>
                <li>Nome completo, e-mail profissional e telefone</li>
                <li>Registro profissional (CRM, COREN, etc.)</li>
                <li>Função e especialidade</li>
                <li>Dados de acesso (logs, IP, horários)</li>
              </ul>

              <h3>2.2 Dados dos Pacientes</h3>
              <ul>
                <li>Nome completo, data de nascimento, gênero e CPF</li>
                <li>Contatos (telefone, e-mail, endereço)</li>
                <li>
                  Dados clínicos: diagnóstico oncológico, estadiamento,
                  protocolos de tratamento, exames, medicações e histórico de
                  navegação oncológica
                </li>
                <li>Registros de comunicação via WhatsApp (quando aplicável)</li>
              </ul>

              <h3>2.3 Dados Técnicos</h3>
              <ul>
                <li>Cookies e tecnologias de rastreamento</li>
                <li>Endereço IP, tipo de navegador e sistema operacional</li>
                <li>Dados de uso da plataforma (páginas acessadas, cliques)</li>
              </ul>
            </section>

            <section id="finalidade">
              <h2>3. Finalidade do Tratamento</h2>
              <p>Os dados são tratados para as seguintes finalidades:</p>
              <ul>
                <li>
                  <strong>Prestação do serviço:</strong> Coordenação da
                  navegação oncológica, acompanhamento de etapas do tratamento e
                  comunicação com pacientes.
                </li>
                <li>
                  <strong>Inteligência Artificial:</strong> Priorização de
                  pacientes, classificação de risco, sugestões de conduta
                  clínica e agente conversacional.
                </li>
                <li>
                  <strong>Alertas e notificações:</strong> Envio de alertas
                  sobre atrasos no tratamento, etapas pendentes e resultados
                  críticos.
                </li>
                <li>
                  <strong>Auditoria e compliance:</strong> Registro de ações
                  para conformidade regulatória e rastreabilidade.
                </li>
                <li>
                  <strong>Melhoria do serviço:</strong> Análises agregadas e
                  anônimas para aprimoramento da plataforma.
                </li>
              </ul>
            </section>

            <section id="base-legal">
              <h2>4. Base Legal</h2>
              <p>
                O tratamento de dados pessoais pela OncoNav é realizado com base
                nas seguintes hipóteses da LGPD (Art. 7º e Art. 11):
              </p>
              <ul>
                <li>
                  <strong>Execução de contrato</strong> (Art. 7º, V): Para a
                  prestação dos serviços contratados pela instituição de saúde.
                </li>
                <li>
                  <strong>Tutela da saúde</strong> (Art. 11, II, f): Para o
                  tratamento de dados sensíveis de saúde dos pacientes.
                </li>
                <li>
                  <strong>Obrigação legal</strong> (Art. 7º, II): Para
                  cumprimento de obrigações regulatórias (CFM, ANVISA, LGPD).
                </li>
                <li>
                  <strong>Consentimento</strong> (Art. 7º, I): Quando
                  necessário, coletamos consentimento explícito do titular.
                </li>
                <li>
                  <strong>Legítimo interesse</strong> (Art. 7º, IX): Para
                  análises internas e melhoria do serviço, com minimização de
                  impacto ao titular.
                </li>
              </ul>
            </section>

            <section id="compartilhamento">
              <h2>5. Compartilhamento de Dados</h2>
              <p>
                Seus dados podem ser compartilhados nas seguintes situações:
              </p>
              <ul>
                <li>
                  <strong>Instituição de saúde contratante:</strong> Os dados
                  dos pacientes são acessíveis apenas à instituição responsável,
                  dentro do seu ambiente multi-tenant isolado.
                </li>
                <li>
                  <strong>Prestadores de serviço:</strong> Provedores de
                  infraestrutura (cloud), serviços de IA e comunicação
                  (WhatsApp Business API), todos com contratos de proteção de
                  dados.
                </li>
                <li>
                  <strong>Autoridades competentes:</strong> Quando exigido por
                  lei, regulamento ou ordem judicial.
                </li>
              </ul>
              <p>
                <strong>Não vendemos, alugamos ou compartilhamos</strong> dados
                pessoais ou de saúde com terceiros para fins comerciais ou de
                marketing.
              </p>
            </section>

            <section id="seguranca">
              <h2>6. Segurança dos Dados</h2>
              <p>
                Adotamos medidas técnicas e organizacionais para proteger seus
                dados:
              </p>
              <ul>
                <li>
                  <strong>Criptografia em trânsito:</strong> TLS 1.3 (HTTPS)
                  para todas as comunicações.
                </li>
                <li>
                  <strong>Criptografia em repouso:</strong> AES-256 para dados
                  sensíveis armazenados.
                </li>
                <li>
                  <strong>Isolamento multi-tenant:</strong> Dados de cada
                  instituição são completamente isolados.
                </li>
                <li>
                  <strong>Controle de acesso:</strong> RBAC (Role-Based Access
                  Control) com autenticação JWT e MFA.
                </li>
                <li>
                  <strong>Auditoria:</strong> Logs imutáveis de todas as ações
                  com retenção mínima de 5 anos.
                </li>
                <li>
                  <strong>Backup:</strong> Backups automáticos diários,
                  criptografados e georredundantes.
                </li>
                <li>
                  <strong>Monitoramento:</strong> Monitoramento contínuo de
                  segurança e disponibilidade (SLA 99.9%).
                </li>
              </ul>
            </section>

            <section id="retencao">
              <h2>7. Retenção de Dados</h2>
              <p>
                Os dados pessoais são retidos pelo período necessário para
                cumprir as finalidades descritas nesta política:
              </p>
              <ul>
                <li>
                  <strong>Dados de conta profissional:</strong> Enquanto o
                  contrato com a instituição estiver ativo, e por até 5 anos
                  após o encerramento.
                </li>
                <li>
                  <strong>Dados clínicos de pacientes:</strong> Conforme
                  exigências regulatórias do CFM (mínimo de 20 anos para
                  prontuários).
                </li>
                <li>
                  <strong>Logs de auditoria:</strong> Mínimo de 5 anos.
                </li>
                <li>
                  <strong>Dados de navegação:</strong> Até 2 anos para fins de
                  análise.
                </li>
              </ul>
            </section>

            <section id="direitos">
              <h2>8. Seus Direitos (LGPD)</h2>
              <p>
                Como titular de dados, você tem os seguintes direitos conforme a
                LGPD (Art. 18):
              </p>
              <ol>
                <li>
                  <strong>Confirmação e acesso:</strong> Saber se tratamos seus
                  dados e obter cópia.
                </li>
                <li>
                  <strong>Correção:</strong> Solicitar a correção de dados
                  incompletos, inexatos ou desatualizados.
                </li>
                <li>
                  <strong>Anonimização ou eliminação:</strong> Solicitar a
                  anonimização ou eliminação de dados desnecessários ou
                  excessivos.
                </li>
                <li>
                  <strong>Portabilidade:</strong> Solicitar a transferência dos
                  seus dados para outro fornecedor.
                </li>
                <li>
                  <strong>Revogação do consentimento:</strong> Revogar o
                  consentimento a qualquer momento.
                </li>
                <li>
                  <strong>Informação sobre compartilhamento:</strong> Saber com
                  quem seus dados foram compartilhados.
                </li>
                <li>
                  <strong>Oposição:</strong> Opor-se ao tratamento quando
                  realizado com base em legítimo interesse.
                </li>
              </ol>
              <p>
                Para exercer seus direitos, entre em contato com nosso
                Encarregado (DPO) através do e-mail informado na seção de
                contato.
              </p>
            </section>

            <section id="cookies">
              <h2>9. Cookies</h2>
              <p>Utilizamos cookies para:</p>
              <ul>
                <li>
                  <strong>Cookies essenciais:</strong> Necessários para o
                  funcionamento da plataforma (autenticação, sessão).
                </li>
                <li>
                  <strong>Cookies analíticos:</strong> Análise de uso agregada
                  para melhoria do serviço.
                </li>
              </ul>
              <p>
                Não utilizamos cookies de terceiros para fins publicitários.
                Você pode configurar seu navegador para recusar cookies, mas
                isso pode afetar a funcionalidade da plataforma.
              </p>
            </section>

            <section id="menores">
              <h2>10. Menores de Idade</h2>
              <p>
                A OncoNav é destinada ao uso por profissionais de saúde. Dados
                de pacientes menores de idade são tratados exclusivamente sob a
                responsabilidade e supervisão da instituição de saúde
                contratante, com consentimento do responsável legal quando
                aplicável.
              </p>
            </section>

            <section id="alteracoes">
              <h2>11. Alterações nesta Política</h2>
              <p>
                Podemos atualizar esta Política de Privacidade periodicamente.
                Quaisquer alterações significativas serão comunicadas por e-mail
                ou notificação na plataforma com antecedência razoável. A data
                da última atualização está indicada no topo desta página.
              </p>
            </section>

            <section id="contato">
              <h2>12. Contato e DPO</h2>
              <p>
                Para dúvidas, solicitações ou exercício de direitos relacionados
                à proteção de dados, entre em contato:
              </p>
              <ul>
                <li>
                  <strong>Encarregado (DPO):</strong> dpo@onconav.com.br
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
              <p>
                Respondemos a todas as solicitações no prazo de 15 dias úteis,
                conforme determina a LGPD.
              </p>
            </section>

            <div className="mt-12 rounded-xl border border-sky-200 bg-sky-50 p-6">
              <p className="text-sm text-sky-800">
                <strong>Nota:</strong> Esta Política de Privacidade é parte
                integrante dos{' '}
                <Link
                  href="/termos"
                  className="underline hover:text-sky-600 transition-colors"
                >
                  Termos de Serviço
                </Link>{' '}
                da plataforma OncoNav.
              </p>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
