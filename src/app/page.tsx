import Link from 'next/link';
import PageHeader from '@/components/PageHeader';

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
