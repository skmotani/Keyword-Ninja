'use client';

import Link from 'next/link';

const categories = [
  {
    title: 'TFO Twisters',
    description: 'Two-For-One twisting technology for high-speed, efficient yarn production with superior twist quality.',
    href: '/twisting-machines/tfo-twisters',
    icon: '🔄',
    products: ['TPRS Twister Machine', 'Filament Yarn Twister']
  },
  {
    title: 'Ring Twisters',
    description: 'Traditional ring twisting for versatile yarn processing with proven reliability.',
    href: '/twisting-machines/ring-twisters',
    icon: '⭕',
    products: ['Ring Twister', 'Embroidery Thread Twister']
  },
  {
    title: 'Spun Yarn Twisters',
    description: 'Specialized machines for spun yarn applications with precise tension control.',
    href: '/twisting-machines/spun-yarn-twisters',
    icon: '🧵',
    products: ['Spun Yarn Twister', 'Heavy Duty Cabler']
  }
];

const applications = [
  { title: 'Industrial Yarn', href: '/twisting-machines/applications/industrial-yarn', icon: '🏭' },
  { title: 'Carpet Yarn', href: '/twisting-machines/applications/carpet-yarn', icon: '🏠' },
  { title: 'Rope & Cordage', href: '/twisting-machines/applications/rope-cordage', icon: '🪢' },
  { title: 'Embroidery Thread', href: '/twisting-machines/applications/embroidery-thread', icon: '🪡' },
  { title: 'Medical Sutures', href: '/twisting-machines/applications/medical-suture', icon: '🏥' },
  { title: 'Monofilament', href: '/twisting-machines/applications/monofilament', icon: '🎣' }
];

const guides = [
  { title: 'What is a TFO Machine?', href: '/guides/what-is-a-tfo-machine' },
  { title: 'Yarn Twist Calculation', href: '/guides/yarn-twist-calculation' },
  { title: 'Yarn Ballooning Solutions', href: '/guides/yarn-ballooning-solution' },
  { title: 'Twisting Defects & Solutions', href: '/guides/twisting-defects-and-solutions' }
];

const comparisons = [
  { title: 'TFO vs Ring Twister', href: '/compare/tfo-vs-ring-twister' },
  { title: 'Cabler vs Two-For-One Twister', href: '/compare/cabler-vs-two-for-one-twister' },
  { title: 'TFO Machine: Price vs Output', href: '/compare/tfo-machine-price-vs-output' }
];

export default function TwistingMachinesHub() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Twisting Machines
            </h1>
            <p className="text-xl text-indigo-200 max-w-3xl mx-auto mb-8">
              Complete range of industrial twisting machines for yarn manufacturing. 
              From TFO twisters to ring twisters, find the perfect solution for your textile production needs.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a 
                href="https://www.meera.ind.in/products.html" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-6 py-3 bg-white text-indigo-700 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
              >
                View All Products
              </a>
              <Link 
                href="/guides/what-is-a-tfo-machine"
                className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg border border-indigo-400 hover:bg-indigo-500 transition-colors"
              >
                Learn About TFO
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Machine Categories */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Machine Categories</h2>
          <p className="text-gray-600 mb-8">Explore our range of twisting machines by category</p>
          
          <div className="grid md:grid-cols-3 gap-6">
            {categories.map((category) => (
              <Link 
                key={category.href}
                href={category.href}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-100"
              >
                <div className="text-4xl mb-4">{category.icon}</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">{category.title}</h3>
                <p className="text-gray-600 text-sm mb-4">{category.description}</p>
                <div className="flex flex-wrap gap-2">
                  {category.products.map((product) => (
                    <span key={product} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded">
                      {product}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Applications Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Applications</h2>
          <p className="text-gray-600 mb-8">Discover how twisting machines serve different industries</p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {applications.map((app) => (
              <Link 
                key={app.href}
                href={app.href}
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4 text-center border border-gray-100"
              >
                <div className="text-3xl mb-2">{app.icon}</div>
                <h3 className="text-sm font-medium text-gray-800">{app.title}</h3>
              </Link>
            ))}
          </div>
        </section>

        {/* Guides & Comparisons Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* Technical Guides */}
          <section className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">📚</span> Technical Guides
            </h2>
            <ul className="space-y-3">
              {guides.map((guide) => (
                <li key={guide.href}>
                  <Link 
                    href={guide.href}
                    className="flex items-center gap-3 text-gray-700 hover:text-indigo-600 transition-colors"
                  >
                    <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {guide.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Comparisons */}
          <section className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">⚖️</span> Machine Comparisons
            </h2>
            <ul className="space-y-3">
              {comparisons.map((comp) => (
                <li key={comp.href}>
                  <Link 
                    href={comp.href}
                    className="flex items-center gap-3 text-gray-700 hover:text-indigo-600 transition-colors"
                  >
                    <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    {comp.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Featured Products from Meera */}
        <section className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-8 text-white">
          <h2 className="text-2xl font-bold mb-4">Featured Twisting Machines from Meera Industries</h2>
          <p className="text-gray-300 mb-6">
            Meera Industries is a leading manufacturer of twisting machines with over 30 years of experience. 
            Our machines are trusted by textile manufacturers worldwide for their reliability, efficiency, and precision.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <a 
              href="https://www.meera.ind.in/tprs-twister-machine.html"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-700 hover:bg-gray-600 rounded-lg p-4 transition-colors"
            >
              <h3 className="font-semibold mb-1">TPRS Twister Machine</h3>
              <p className="text-sm text-gray-400">High-speed TFO twisting for industrial yarns</p>
            </a>
            <a 
              href="https://www.meera.ind.in/ring-twister.html"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-700 hover:bg-gray-600 rounded-lg p-4 transition-colors"
            >
              <h3 className="font-semibold mb-1">Ring Twister</h3>
              <p className="text-sm text-gray-400">Versatile ring twisting technology</p>
            </a>
            <a 
              href="https://www.meera.ind.in/heavy-duty-twister-cabler-machine.html"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-700 hover:bg-gray-600 rounded-lg p-4 transition-colors"
            >
              <h3 className="font-semibold mb-1">Heavy Duty Cabler</h3>
              <p className="text-sm text-gray-400">For rope and heavy yarn applications</p>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
