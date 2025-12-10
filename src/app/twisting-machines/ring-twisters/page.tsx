'use client';

import Link from 'next/link';
import Image from 'next/image';

const products = [
  {
    name: 'Ring Twister',
    description: 'Traditional ring twisting machine with modern enhancements for reliable yarn processing. Ideal for a wide range of yarn types and twist levels.',
    href: 'https://www.meera.ind.in/ring-twister.html',
    features: ['Wide twist range capability', 'Robust spindle design', 'Easy maintenance', 'Flexible package sizes'],
    applications: ['Cotton yarn', 'Blended yarns', 'Specialty yarns']
  },
  {
    name: 'Embroidery Thread Twister',
    description: 'Precision ring twister specifically designed for embroidery thread production with superior luster retention and minimal yarn damage.',
    href: 'https://www.meera.ind.in/embroidery-thread-twister.html',
    features: ['Gentle yarn handling', 'Luster preservation', 'High twist uniformity', 'Multi-ply capability'],
    applications: ['Embroidery thread', 'Decorative yarns', 'Craft threads']
  }
];

const relatedLinks = [
  { title: 'TFO vs Ring Twister Comparison', href: '/compare/tfo-vs-ring-twister' },
  { title: 'Embroidery Thread Applications', href: '/twisting-machines/applications/embroidery-thread' },
  { title: 'Twisting Defects & Solutions', href: '/guides/twisting-defects-and-solutions' }
];

export default function RingTwistersPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/twisting-machines" className="text-indigo-600 hover:underline">Twisting Machines</Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600">Ring Twisters</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-r from-green-600 to-teal-700 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4">Ring Twisters</h1>
          <p className="text-xl text-green-100 max-w-3xl">
            Time-tested ring twisting technology with modern innovations for versatile yarn processing 
            and consistent quality across diverse applications.
          </p>
        </div>
      </div>

      {/* Featured Image */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="relative h-64 rounded-xl overflow-hidden shadow-lg">
          <Image 
            src="/images/hub/industrial_yarn_spoo_a4002aec.jpg" 
            alt="Ring twisting machinery"
            fill
            className="object-cover"
          />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Introduction */}
        <section className="bg-white rounded-xl shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">About Ring Twisting Technology</h2>
          <p className="text-gray-600 mb-4">
            Ring twisting is a conventional yarn twisting method that uses a ring and traveler system to impart 
            twist to the yarn. This technology has been refined over decades and remains popular for its 
            versatility, reliability, and ability to handle a wide range of yarn types.
          </p>
          <p className="text-gray-600">
            Meera Industries&apos; ring twisters combine traditional reliability with modern features like 
            electronic controls, improved spindle designs, and enhanced ergonomics. Our machines are suitable 
            for cotton, synthetic, and blended yarns across various count ranges.
          </p>
        </section>

        {/* Products Grid */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Our Ring Twister Range</h2>
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
                        <span key={idx} className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded">
                          {app}
                        </span>
                      ))}
                    </div>
                  </div>

                  <a 
                    href={product.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
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
                <span className="text-teal-600 font-medium">{link.title}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
