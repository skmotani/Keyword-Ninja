'use client';

import Link from 'next/link';
import Image from 'next/image';

const products = [
  {
    name: 'TPRS Twister Machine',
    description: 'High-speed Two-For-One twister designed for industrial yarn production. Features precision spindle technology and advanced tension control for consistent twist quality.',
    href: 'https://www.meera.ind.in/tprs-twister-machine.html',
    features: ['High-speed operation up to 15,000 RPM', 'Precision tension control', 'Low energy consumption', 'Automatic package doffing'],
    applications: ['Industrial yarn', 'Technical textiles', 'Tire cord']
  },
  {
    name: 'Filament Yarn Twister',
    description: 'Specialized TFO machine for filament yarn processing with gentle handling to maintain yarn integrity and luster.',
    href: 'https://www.meera.ind.in/filament-yarn-twister.html',
    features: ['Gentle yarn handling', 'Adjustable balloon control', 'Multi-denier capability', 'High package weight capacity'],
    applications: ['Polyester filament', 'Nylon filament', 'Specialty fibers']
  }
];

const relatedLinks = [
  { title: 'What is a TFO Machine?', href: '/guides/what-is-a-tfo-machine' },
  { title: 'TFO vs Ring Twister Comparison', href: '/compare/tfo-vs-ring-twister' },
  { title: 'TFO Machine Price vs Output', href: '/compare/tfo-machine-price-vs-output' }
];

export default function TFOTwistersPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/twisting-machines" className="text-indigo-600 hover:underline">Twisting Machines</Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600">TFO Twisters</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4">TFO Twisters</h1>
          <p className="text-xl text-blue-100 max-w-3xl">
            Two-For-One (TFO) twisting technology delivers twice the twist per spindle revolution, 
            offering superior efficiency and yarn quality for industrial applications.
          </p>
        </div>
      </div>

      {/* Featured Image */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="relative h-64 rounded-xl overflow-hidden shadow-lg">
          <Image 
            src="/images/hub/textile_spinning_mac_b187021d.jpg" 
            alt="TFO twisting machinery"
            fill
            className="object-cover"
          />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Introduction */}
        <section className="bg-white rounded-xl shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">About TFO Twisting Technology</h2>
          <p className="text-gray-600 mb-4">
            TFO (Two-For-One) twisting is an advanced yarn twisting technology that imparts two twists to the yarn 
            for every single rotation of the spindle. This revolutionary approach doubles the productivity compared 
            to conventional ring twisting while reducing energy consumption and floor space requirements.
          </p>
          <p className="text-gray-600">
            Meera Industries offers a comprehensive range of TFO twisters designed for various yarn types and 
            applications. Our machines feature robust construction, precision engineering, and user-friendly 
            controls to ensure consistent quality and maximum uptime.
          </p>
        </section>

        {/* Products Grid */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Our TFO Twister Range</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {products.map((product) => (
              <div key={product.name} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-3">{product.name}</h3>
                  <p className="text-gray-600 mb-4">{product.description}</p>
                  
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Key Features:</h4>
                    <ul className="space-y-1">
                      {product.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                          <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Applications:</h4>
                    <div className="flex flex-wrap gap-2">
                      {product.applications.map((app, idx) => (
                        <span key={idx} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">
                          {app}
                        </span>
                      ))}
                    </div>
                  </div>

                  <a 
                    href={product.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    View Product Details
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Related Content */}
        <section className="bg-gray-100 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Related Resources</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {relatedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="bg-white rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <span className="text-indigo-600 font-medium">{link.title}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
