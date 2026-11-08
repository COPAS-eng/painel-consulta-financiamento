const sections = [
  {
    title: 'Plataformas',
    links: [
      { name: 'Loft', url: 'https://loft.com.br/para-imobiliarias/financiamento-imobiliario/' },
      { name: 'Rauzee', url: 'https://rauzee.com/recursos/site-imobiliario-integrado/' },
      { name: 'Rauzee — Simulador', url: 'https://rauzee.com/blog/simulador-habitacional-da-rauzee-a-ferramenta-essencial-para-quem-quer-mais-agilidade/' },
      { name: 'Homer', url: 'https://www.homer.com.br/creditoimobiliario/' },
    ],
  },
  {
    title: 'Bancos',
    links: [
      { name: 'Banco do Brasil', url: 'https://www.bb.com.br/site/pra-voce/financiamentos/financiamento-imobiliario/' },
      { name: 'Itaú', url: 'https://www.itau.com.br/emprestimos-financiamentos/credito-imobiliario' },
      { name: 'Santander', url: 'https://www.santander.com.br/atendimento-para-voce/simuladores/simulador-credito-imobiliario' },
      { name: 'Caixa (Simulador Habitacional)', url: 'https://simuladorhabitacao.caixa.gov.br/home' },
    ],
  },
];

export function SimulationServicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-semibold text-primary-900">Serviços de Simulação</h1>
        <p className="text-sm text-gray-500 mt-1">Links de redirecionamento para plataformas e bancos.</p>
      </div>
      {sections.map((section) => (
        <div key={section.title} className="card p-6">
          <h2 className="text-lg font-semibold text-primary-800 mb-4">{section.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {section.links.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:border-primary-300 hover:text-primary-700 transition-colors"
              >
                <span>{link.name}</span>
                <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}