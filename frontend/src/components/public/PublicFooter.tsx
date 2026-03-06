import React from 'react';
import Link from 'next/link';
import { Activity, Mail, MapPin, Phone } from 'lucide-react';

const footerSections = [
  {
    title: 'Produto',
    links: [
      { label: 'Funcionalidades', href: '/#recursos' },
      { label: 'Como Funciona', href: '/#como-funciona' },
      { label: 'Integrações', href: '/#recursos' },
      { label: 'Preços', href: '/login' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { label: 'Sobre Nós', href: '/' },
      { label: 'Blog', href: '/' },
      { label: 'Carreiras', href: '/' },
      { label: 'Contato', href: '/' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Política de Privacidade', href: '/privacidade' },
      { label: 'Termos de Serviço', href: '/termos' },
      { label: 'LGPD', href: '/privacidade' },
      { label: 'Segurança', href: '/privacidade#seguranca' },
    ],
  },
];

export const PublicFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="py-12 lg:py-16">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Link href="/" className="flex items-center gap-2 group">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 shadow-md">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold tracking-tight text-gradient-blue">
                  ONCONAV
                </span>
              </Link>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Plataforma SaaS de navegação oncológica com IA. Coordene o
                cuidado do paciente, reduza atrasos no tratamento e melhore
                desfechos clínicos.
              </p>
              <div className="mt-6 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span>contato@onconav.com.br</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  <span>(27) 99999-0000</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>Vitória, ES — Brasil</span>
                </div>
              </div>
            </div>

            {footerSections.map((section) => (
              <div key={section.title}>
                <h3 className="text-sm font-semibold text-foreground">
                  {section.title}
                </h3>
                <ul className="mt-4 space-y-3">
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {currentYear} OncoNav. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/privacidade"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacidade
            </Link>
            <Link
              href="/termos"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Termos
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
