'use client';

import Link from 'next/link';
import Image from 'next/image';

const products = [
  {
    name: 'Spun Yarn Twister',
    description: 'Specialized twisting machine designed for spun yarn applications with precise tension control and gentle yarn handling to maintain fiber integrity.',
    href: 'https://www.meera.ind.in/spun-yarn-twister.html',
    features: ['Precision tension control', 'Low twist variation', 'Multiple spindle configurations', 'Quick package changeover'],
    applications: ['Cotton spun yarn', 'Wool yarn', 'Synthetic spun yarn']
  },
  {
    name: 'Heavy Duty Twister/Cabler Machine',
    description: 'Robust cabling machine for heavy-duty yarn and rope applications. Designed to handle high-tenacity yarns and multiple plies.',
    href: 'https://www.meera.ind.in/heavy-duty-twister-cabler-machine.html',
    features: ['Heavy-duty construction', 'High tension capacity', 'Multi-ply cabling', 'Variable speed control'],
    applications: ['Tire cord', 'Rope and cordage', 'Industrial yarn']
  },
  {
    name: 'Covering Machine',
    description: 'Specialized machine for covering core yarns with wrap yarns for elastic and specialty yarn production.',
    href: 'https://www.meera.ind.in/covering-machine.html',
    features: ['Single and double covering', 'Elastane compatibility', 'Precision wrap control', 'High-speed operation'],
    applications: ['Covered elastic yarn', 'Fancy yarns', 'Technical textiles']
  }
];

const relatedLinks = [
  { title: 'Industrial Yarn Applications', href: '/twisting-machines/applications/industrial-yarn' },
  { title: 'Rope & Cordage Applications', href: '/twisting-machines/applications/rope-cordage' },
  { title: 'Cabler vs TFO Comparison', href: '/compare/cabler-vs-two-for-one-twister' }
];

export default function SpunYarnTwistersPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/twisting-machines" className="text-indigo-600 hover:underline">Twisting Machines</Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600">Spun Yarn Twisters</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4">Spun Yarn Twisters</h1>
          <p className="text-xl text-purple-100 max-w-3xl">
            Specialized machines for spun yarn and heavy-duty applications including cabling, 
            covering, and multi-ply twisting for industrial and technical textiles.
          </p>
        </div>
      </div>

      {/* Featured Image */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="relative h-64 rounded-xl overflow-hidden shadow-lg">
          <Image 
            src="/images/hub/textile_spinning_mac_e0e11a82.jpg" 
            alt="Spun yarn twisting equipment"
            fill
            className="object-cover"
          />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Introduction */}
        <section className="bg-white rounded-xl shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">About Spun Yarn Twisting</h2>
          <p className="text-gray-600 mb-4">
            Spun yarn twisting requires specialized machinery that can handle the unique characteristics of 
            staple fiber yarns. Unlike filament yarns, spun yarns have natural irregularities and require 
            gentle handling to maintain fiber alignment and minimize yarn damage.
          </p>
          <p className="text-gray-600">
            Meera Industries offers a complete range of spun yarn twisters, cablers, and covering machines 
            designed for optimal performance with cotton, wool, synthetic, and blended spun yarns. Our 
            heavy-duty machines are built to handle demanding industrial applications like tire cord and rope production.
          </p>
        </section>

        {/* Products Grid */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Our Spun Yarn Machine Range</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {products.map((product) => (
              <div key={product.name} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-3">{product.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{product.description}</p>
                  
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
                        <span key={idx} className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded">
                          {app}
                        </span>
                      ))}
                    </div>
                  </div>

                  <a 
                    href={product.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    View Details
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
                <span className="text-purple-600 font-medium">{link.title}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
