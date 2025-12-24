import Link from 'next/link';
import PageHeader from '@/components/PageHeader';

const dashboardPageHelp = {
  title: 'SEO Intelligence Dashboard',
  description: 'The mission control center for your Agency\'s SEO operations.',
  whyWeAddedThis: 'To give you quick access to the most frequently used modules: Client Management, Competitors, and Keywords.',
  examples: [],
  nuances: 'This dashboard will evolve to show live charts and alerts in the future.',
  useCases: [
    'Quick navigation to different modules',
    'Overview of system capabilities'
  ]
};

const dashboardPageDescription = `
  Welcome to your **SEO Keyword Intelligence Platform**.
  
  This application allows you to conduct deep competitor research, track keyword rankings, and uncover hidden search opportunities for your clients.

  **Getting Started:**
  1.  **[Client Master Data](/clients):** Add your client details first.
  2.  **[Competitor Master](/competitors):** Define who your clients are fighting against.
  3.  **Keywords:** Use tools like [Keyword Manual Master](/keywords/manual) or [SERP Results](/keywords/serp-results) to gather intelligence.
`;

export default function HomePage() {
  const cards = [
    {
      title: 'Clients',
      description: 'Manage your client database with codes, domains, and notes.',
      href: '/clients',
      icon: '👥',
    },
    {
      title: 'Competitors',
      description: 'Track competitors for each client with their domains.',
      href: '/competitors',
      icon: '🎯',
    },
    {
      title: 'Keyword Manual',
      description: 'Manage manually collected keywords from client interviews.',
      href: '/keywords/manual',
      icon: '🔑',
    },
  ];

  return (
    <div>
      <PageHeader
        title="SEO Keyword Intelligence Platform"
        description="Your central hub for managing SEO research data"
        helpInfo={dashboardPageHelp}
        extendedDescription={dashboardPageDescription}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="block p-6 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow"
          >
            <div className="text-4xl mb-4">{card.icon}</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{card.title}</h2>
            <p className="text-gray-600">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
