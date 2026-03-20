'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  BrainCircuit,
  HeartPulse,
  MessageSquare,
  Network,
  Shield,
  Timer,
  Users,
  Zap,
} from 'lucide-react';

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('visible');
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

function AnimatedCounter({
  target,
  suffix = '',
  prefix = '',
}: {
  target: number;
  suffix?: string;
  prefix?: string;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1800;
          const steps = 60;
          const increment = target / steps;
          let current = 0;
          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              setCount(target);
              clearInterval(timer);
            } else {
              setCount(Math.floor(current));
            }
          }, duration / steps);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref}>
      {prefix}
      {count}
      {suffix}
    </span>
  );
}

const features = [
  {
    icon: BarChart3,
    title: 'Dashboard Inteligente',
    description:
      'Visão completa do fluxo de pacientes com métricas em tempo real, alertas de atraso e indicadores de performance da navegação.',
  },
  {
    icon: HeartPulse,
    title: 'Navegação Oncológica',
    description:
      'Protocolos clínicos por tipo de câncer com etapas automatizadas, prazos críticos e acompanhamento longitudinal do paciente.',
  },
  {
    icon: MessageSquare,
    title: 'Agente IA via WhatsApp',
    description:
      'Chatbot inteligente para comunicação com pacientes, triagem de sintomas, lembretes de consultas e suporte 24/7.',
  },
  {
    icon: Bell,
    title: 'Alertas em Tempo Real',
    description:
      'Notificações automáticas para etapas atrasadas, resultados pendentes e pacientes que necessitam de atenção imediata.',
  },
  {
    icon: Network,
    title: 'Integração FHIR/HL7',
    description:
      'Interoperabilidade com sistemas hospitalares via padrões internacionais, sincronização de dados clínicos e prontuários.',
  },
  {
    icon: BrainCircuit,
    title: 'Priorização por IA',
    description:
      'Algoritmos de machine learning que classificam pacientes por urgência, preveem riscos e otimizam a fila de atendimento.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Cadastre sua Instituição',
    description:
      'Configure sua clínica ou hospital em minutos. Ambiente multi-tenant com isolamento total de dados e compliance LGPD.',
    icon: Shield,
  },
  {
    number: '02',
    title: 'Registre seus Pacientes',
    description:
      'Importe dados existentes ou cadastre novos pacientes. A IA inicia automaticamente o protocolo de navegação adequado.',
    icon: Users,
  },
  {
    number: '03',
    title: 'Monitore e Otimize',
    description:
      'Acompanhe cada etapa da jornada oncológica pelo dashboard. Receba alertas inteligentes e tome decisões baseadas em dados.',
    icon: Zap,
  },
];

const metrics = [
  { value: 40, suffix: '%', label: 'Redução de atrasos no tratamento' },
  { value: 98, suffix: '%', label: 'Uptime da plataforma (SLA)' },
  { value: 3, suffix: 'x', label: 'Mais eficiência na navegação' },
  { value: 24, suffix: '/7', label: 'Monitoramento contínuo por IA' },
];

export default function LandingPage() {
  const heroRef = useReveal();
  const metricsRef = useReveal();
  const featuresRef = useReveal();
  const stepsRef = useReveal();
  const ctaRef = useReveal();

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-50 via-white to-blue-50" />
          <div className="absolute top-20 right-1/4 h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
          <div className="absolute bottom-10 left-1/4 h-96 w-96 rounded-full bg-blue-200/20 blur-3xl" />
        </div>

        <div
          ref={heroRef}
          className="reveal mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center"
        >
          <div className="flex justify-center gap-2 mb-8 flex-wrap">
            {['IA + Oncologia', 'Multi-tenant', 'LGPD Compliant'].map(
              (badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1 text-xs font-medium text-sky-700"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  {badge}
                </span>
              )
            )}
          </div>

          <h1 className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Navegação Oncológica{' '}
            <span className="text-gradient-blue">Inteligente</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Coordene a jornada do paciente oncológico com IA. Reduza atrasos,
            melhore desfechos e transforme o cuidado em saúde com a plataforma
            mais completa de navegação oncológica do Brasil.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button
                size="lg"
                className="h-12 px-8 text-base bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all"
              >
                Começar Agora
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/#recursos">
              <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                Saiba Mais
              </Button>
            </Link>
          </div>

          <div className="mt-16 mx-auto max-w-3xl">
            <div className="relative rounded-xl border border-border bg-white/60 backdrop-blur shadow-2xl shadow-sky-500/10 p-1">
              <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                <span className="ml-3 text-xs text-muted-foreground">
                  OncoNav — Painel
                </span>
              </div>
              <div className="p-6 grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-gradient-to-br from-sky-50 to-sky-100 p-4 text-center">
                  <Timer className="mx-auto h-6 w-6 text-sky-600 mb-2" />
                  <div className="text-lg font-bold text-sky-700">12 dias</div>
                  <div className="text-[11px] text-sky-600/80">
                    Tempo médio porta-tratamento
                  </div>
                </div>
                <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 text-center">
                  <Activity className="mx-auto h-6 w-6 text-emerald-600 mb-2" />
                  <div className="text-lg font-bold text-emerald-700">847</div>
                  <div className="text-[11px] text-emerald-600/80">
                    Pacientes ativos
                  </div>
                </div>
                <div className="rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 p-4 text-center">
                  <Bell className="mx-auto h-6 w-6 text-amber-600 mb-2" />
                  <div className="text-lg font-bold text-amber-700">3</div>
                  <div className="text-[11px] text-amber-600/80">
                    Alertas críticos
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Métricas */}
      <section className="py-16 sm:py-20 bg-white border-y border-border">
        <div
          ref={metricsRef}
          className="reveal mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        >
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="text-center">
                <div className="text-3xl font-extrabold text-gradient-blue sm:text-4xl lg:text-5xl">
                  <AnimatedCounter
                    target={metric.value}
                    suffix={metric.suffix}
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="recursos" className="py-20 sm:py-28">
        <div
          ref={featuresRef}
          className="reveal mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        >
          <div className="text-center mb-16">
            <span className="inline-block rounded-full bg-sky-50 border border-sky-200 px-4 py-1 text-xs font-semibold text-sky-700 mb-4">
              Funcionalidades
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Tudo que você precisa para a{' '}
              <span className="text-gradient-blue">navegação oncológica</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Uma plataforma completa que integra IA, comunicação e protocolos
              clínicos para otimizar cada etapa do cuidado oncológico.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-border bg-white p-6 hover:border-sky-200 hover:shadow-lg hover:shadow-sky-500/5 transition-all duration-300"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 group-hover:bg-gradient-to-br group-hover:from-sky-500 group-hover:to-blue-600 transition-all duration-300">
                  <feature.icon className="h-5 w-5 text-sky-600 group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section
        id="como-funciona"
        className="py-20 sm:py-28 bg-slate-50 border-y border-border"
      >
        <div
          ref={stepsRef}
          className="reveal mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        >
          <div className="text-center mb-16">
            <span className="inline-block rounded-full bg-emerald-50 border border-emerald-200 px-4 py-1 text-xs font-semibold text-emerald-700 mb-4">
              Como Funciona
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Comece em{' '}
              <span className="text-gradient-green">3 passos simples</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Da configuração ao monitoramento inteligente, tudo é pensado para
              ser rápido e intuitivo.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.number} className="relative text-center">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] border-t-2 border-dashed border-sky-200" />
                )}
                <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-white border border-border shadow-sm">
                  <step.icon className="h-10 w-10 text-sky-600" />
                  <span className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-xs font-bold text-white shadow-md">
                    {step.number}
                  </span>
                </div>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-sky-600 via-blue-600 to-blue-700" />
        <div className="absolute inset-0 -z-10 opacity-20">
          <div className="absolute top-0 left-1/3 h-64 w-64 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-sky-300 blur-3xl" />
        </div>

        <div
          ref={ctaRef}
          className="reveal mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Pronto para transformar a navegação oncológica?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-sky-100">
            Junte-se às instituições que já estão usando IA para reduzir atrasos
            e melhorar o cuidado do paciente oncológico.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button
                size="lg"
                className="h-12 px-8 text-base bg-white text-blue-700 hover:bg-sky-50 shadow-lg hover:shadow-xl transition-all"
              >
                Começar Agora
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/#recursos">
              <Button
                variant="outline"
                size="lg"
                className="h-12 px-8 text-base border-white/30 text-white hover:bg-white/10 hover:text-white"
              >
                Ver Funcionalidades
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
