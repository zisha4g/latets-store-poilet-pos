import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Helmet } from 'react-helmet-async';
import { Check } from 'lucide-react';

const PricingCard = ({ plan, price, features, isFeatured = false }) => (
    <div className={`p-8 rounded-2xl border ${isFeatured ? 'border-primary shadow-2xl scale-105 bg-card' : 'bg-secondary'}`}>
        {isFeatured && <div className="text-center mb-4"><span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold">Most Popular</span></div>}
        <h3 className="text-2xl font-bold text-center mb-2">{plan}</h3>
        <p className="text-4xl font-extrabold text-center mb-6">${price}<span className="text-lg font-medium text-muted-foreground">/mo</span></p>
        <ul className="space-y-4 mb-8">
            {features.map((feature, i) => (
                <li key={i} className="flex items-center">
                    <Check className="w-5 h-5 text-green-500 mr-3" />
                    <span>{feature}</span>
                </li>
            ))}
        </ul>
        <Button asChild size="lg" className={`w-full text-lg ${!isFeatured && 'bg-card text-card-foreground hover:bg-card/90'}`}>
            <Link to="/signup">Get Started</Link>
        </Button>
    </div>
);

const PricingPage = () => {
  const plans = {
    basic: {
      name: "Basic",
      price: 29,
      features: ["Point of Sale", "Inventory Management (1000 Products)", "Customer Management", "Basic Reporting"]
    },
    pro: {
      name: "Pro",
      price: 79,
      features: ["All Basic Features", "Inventory Management (Unlimited)", "Full Accounting Suite", "PBX Phone System (1 Number)", "Advanced Reporting"],
      featured: true
    },
    enterprise: {
      name: "Enterprise",
      price: 149,
      features: ["All Pro Features", "Multi-Store Management", "PBX Phone System (Multiple Numbers)", "Dedicated Support", "API Access"]
    }
  };

  return (
    <>
    <Helmet>
        <title>Pricing Plans - StorePilot</title>
        <meta name="description" content="Find the perfect StorePilot plan for your business. From basic POS to a full enterprise suite, we have a plan that fits your needs." />
    </Helmet>
    <div className="bg-background min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
            <Link to="/" className="text-2xl font-bold">StorePilot</Link>
            <Button asChild variant="outline"><Link to="/">Back to Home</Link></Button>
        </nav>
      </header>

      <main className="pt-24">
        <section className="container mx-auto px-6 py-20">
            <div className="text-center max-w-3xl mx-auto">
                <h1 className="text-5xl md:text-6xl font-extrabold mb-4">Find the Right Plan for You</h1>
                <p className="text-xl text-muted-foreground">Simple, transparent pricing. No hidden fees. Ever.</p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto mt-16">
                <PricingCard plan={plans.basic.name} price={plans.basic.price} features={plans.basic.features} />
                <PricingCard plan={plans.pro.name} price={plans.pro.price} features={plans.pro.features} isFeatured={plans.pro.featured} />
                <PricingCard plan={plans.enterprise.name} price={plans.enterprise.price} features={plans.enterprise.features} />
            </div>
        </section>
      </main>
    </div>
    </>
  );
};

export default PricingPage;