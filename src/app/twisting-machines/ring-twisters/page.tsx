'use client';

import Link from 'next/link';
import Image from 'next/image';

const products = [
  {
    name: 'Ring Twister',
    description: 'Achieve premium quality twisting for technical yarns, ropes, and cords with high-speed, precise control and individual spindle motor systems.',
    href: 'https://meeraind.com/product/ring-twister',
    image: '/images/hub/industrial_yarn_spoo_a4002aec.jpg',
    features: ['Wide twist range capability', 'Robust spindle design', 'Easy maintenance', 'Flexible package sizes'],
    applications: ['Technical Textiles', 'PPMF/Tapes & Twines']
  },
  {
    name: 'Embroidery Thread Twister',
    description: 'Precision ring twister specifically designed for embroidery thread production with superior luster retention and minimal yarn damage.',
    href: 'https://meeraind.com/product/ring-twister',
    image: '/images/hub/embroidery_thread_co_1f1ff2a7.jpg',
    features: ['Gentle yarn handling', 'Luster preservation', 'High twist uniformity', 'Multi-ply capability'],
    applications: ['Sewing Industry', 'Decorative yarns', 'Craft threads']
  }
];

const relatedLinks = [
  { title: 'TFO vs Ring Twister', href: '/compare/tfo-vs-ring-twister', description: 'Compare technologies side-by-side' },
  { title: 'Embroidery Thread Applications', href: '/twisting-machines/applications/embroidery-thread', description: 'Explore embroidery solutions' },
  { title: 'Twisting Defects & Solutions', href: '/guides/twisting-defects-and-solutions', description: 'Troubleshoot common issues' }
];

export default function RingTwistersPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <div className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/twisting-machines" className="text-slate-600 hover:text-orange-600 transition-colors">Twisting Machines</Link>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-slate-900 font-medium">Ring Twisters</span>
          </nav>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-slate-900 via-emerald-900 to-teal-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 bg-emerald-500/30 text-emerald-200 text-xs font-medium rounded-full border border-emerald-400/30">
                  Technical Textiles
                </span>
                <span className="px-3 py-1 bg-emerald-500/30 text-emerald-200 text-xs font-medium rounded-full border border-emerald-400/30">
                  PPMF/Tapes & Twines
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6">Ring Twister</h1>
              <p className="text-xl text-slate-300 mb-8">
                Achieve premium quality twisting for technical yarns, ropes, and cords with high-speed, precise control and individual spindle motor systems.
              </p>
              <div className="flex flex-wrap gap-4">
                <a 
                  href="https://meeraind.com/product/ring-twister" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-all transform hover:scale-105 shadow-lg"
                >
                  Explore Our Products
                </a>
                <Link 
                  href="/compare/tfo-vs-ring-twister"
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg border border-white/30 transition-all"
                >
                  Compare with TFO
                </Link>
              </div>
            </div>
            <div className="relative h-80 rounded-2xl overflow-hidden shadow-2xl">
              <Image 
                src="/images/hub/industrial_yarn_spoo_a4002aec.jpg" 
                alt="Ring twisting machinery"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-orange-500 font-medium text-sm uppercase tracking-wider mb-2">Technology Overview</p>
            <h2 className="text-3xl font-bold text-slate-900 mb-6">About Ring Twisting Technology</h2>
            <p className="text-slate-600 mb-4">
              Ring twisting is a conventional yarn twisting method that uses a ring and traveler system to impart 
              twist to the yarn. This technology has been refined over decades and remains popular for its 
              versatility, reliability, and ability to handle a wide range of yarn types.
            </p>
            <p className="text-slate-600 mb-6">
              Meera Industries offers modern ring twisters with enhanced features including individual spindle 
              drives, precision tension control, and advanced monitoring systems for consistent quality output.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-2xl font-bold text-slate-900">Wide</div>
                <div className="text-sm text-slate-600">Twist Range</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-2xl font-bold text-slate-900">High</div>
                <div className="text-sm text-slate-600">Reliability</div>
              </div>
            </div>
          </div>
          <div className="relative h-80 rounded-2xl overflow-hidden shadow-lg">
            <Image 
              src="/images/hub/textile_spinning_mac_e0e11a82.jpg" 
              alt="Ring twister technology"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </div>

      {/* Products Section */}
      <div className="bg-slate-50 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-orange-500 font-medium text-sm uppercase tracking-wider mb-2">Product Range</p>
            <h2 className="text-3xl font-bold text-slate-900">Our Ring Twister Range</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {products.map((product) => (
              <div key={product.name} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200 hover:shadow-xl transition-all group">
                <div className="relative h-56">
                  <Image 
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-8">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {product.applications.map((app) => (
                      <span key={app} className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                        {app}
                      </span>
                    ))}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">{product.name}</h3>
                  <p className="text-slate-600 mb-6">{product.description}</p>
                  
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Key Features:</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {product.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                          <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>

                  <a 
                    href={product.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg transition-colors"
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
        </div>
      </div>

      {/* Related Resources */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <p className="text-orange-500 font-medium text-sm uppercase tracking-wider mb-2">Learn More</p>
          <h2 className="text-3xl font-bold text-slate-900">Related Resources</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {relatedLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-orange-300 hover:shadow-lg transition-all"
            >
              <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-orange-600 transition-colors">{link.title}</h3>
              <p className="text-slate-600 text-sm mb-4">{link.description}</p>
              <span className="inline-flex items-center gap-2 text-orange-600 font-medium text-sm">
                Read more
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-slate-900 to-emerald-900 text-white py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to Upgrade Your Twisting Operations?
          </h2>
          <p className="text-slate-300 mb-6">
            Contact Meera Industries for customized ring twisting solutions tailored to your specific requirements.
          </p>
          <a 
            href="https://meeraind.com/contact" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-all transform hover:scale-105 shadow-lg"
          >
            Request Custom Quote
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
