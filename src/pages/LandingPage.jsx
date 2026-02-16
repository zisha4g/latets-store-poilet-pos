import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { ShoppingCart, Package, Users, BarChart3, Scale, Phone, Video, Eye, ArrowRight, Rocket, Store } from 'lucide-react';

const FeatureCard = ({ icon: Icon, title, description }) => (
  <motion.div
    className="p-6 bg-card rounded-xl shadow-lg border border-border"
    whileHover={{ y: -5, scale: 1.02 }}
    transition={{ type: 'spring', stiffness: 300 }}
  >
    <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg mb-4">
      <Icon className="w-6 h-6 text-primary" />
    </div>
    <h3 className="text-xl font-bold mb-2">{title}</h3>
    <p className="text-muted-foreground">{description}</p>
  </motion.div>
);

const LandingPage = () => {
  return (
    <>
    <Helmet>
        <title>StorePilot - All-In-One Point of Sale for Modern Businesses</title>
        <meta name="description" content="Discover StorePilot, the ultimate cloud-based POS system with integrated inventory, accounting, and PBX features. Start your free trial today." />
    </Helmet>
    <div className="bg-background text-foreground">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2">
            <Rocket className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold">StorePilot</span>
          </Link>
          <div className="flex items-center space-x-4">
             <Button asChild variant="outline">
              <Link to="/store">
                <Store className="mr-2 h-4 w-4" /> Visit Store
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/pricing">Pricing</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/login">Log In</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">Start Free Trial</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main className="pt-20">
        <section className="container mx-auto px-6 py-24 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-5xl md:text-7xl font-extrabold mb-4">
              The <span className="gradient-text">All-in-One</span> Platform
              <br />
              to Run Your Store
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              From point of sale to inventory management, accounting, and even a built-in phone system—StorePilot gives you everything you need to thrive.
            </p>
            <div className="flex justify-center space-x-4">
              <Button asChild size="lg" className="text-lg">
                <Link to="/signup">Start 30-Day Free Trial <ArrowRight className="w-5 h-5 ml-2" /></Link>
              </Button>
              <Button asChild variant="secondary" size="lg" className="text-lg">
                <Link to="/demo">Explore Demo Store <Eye className="w-5 h-5 ml-2" /></Link>
              </Button>
            </div>
             <div className="mt-8">
                <Button asChild variant="link" className="text-lg">
                  <a href="#demo-video">Watch Demo Video <Video className="w-5 h-5 ml-2" /></a>
                </Button>
              </div>
          </motion.div>
        </section>

        <section className="bg-secondary py-20">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold">One Platform, Endless Possibilities</h2>
              <p className="text-lg text-muted-foreground mt-2">Everything you need, beautifully integrated.</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard icon={ShoppingCart} title="Point of Sale" description="An intuitive, fast, and reliable POS system designed to keep your lines moving and sales flowing." />
              <FeatureCard icon={Package} title="Inventory Management" description="Track stock levels in real-time, manage suppliers, and get alerts for low inventory automatically." />
              <FeatureCard icon={Users} title="Customer Management" description="Build lasting relationships with detailed customer profiles, purchase history, and targeted marketing." />
              <FeatureCard icon={Scale} title="Integrated Accounting" description="Simplify your finances with a full-featured accounting module, from chart of accounts to financial reporting." />
              <FeatureCard icon={Phone} title="PBX Phone System" description="Never miss a customer call. A complete phone system with IVR, call logs, and softphone capabilities." />
              <FeatureCard icon={BarChart3} title="Powerful Reporting" description="Make data-driven decisions with comprehensive reports on sales, products, and customer trends." />
            </div>
          </div>
        </section>

        <section id="demo-video" className="container mx-auto px-6 py-24">
            <div className="text-center mb-12">
                <h2 className="text-4xl font-bold">See StorePilot in Action</h2>
                <p className="text-lg text-muted-foreground mt-2">Watch a quick overview of our most powerful features.</p>
            </div>
            <div className="aspect-video bg-card border border-border rounded-2xl shadow-xl max-w-4xl mx-auto flex items-center justify-center">
                 <img className="w-full h-full object-cover rounded-2xl" alt="Video demonstration of the StorePilot application in use." src="https://images.unsplash.com/photo-1486476477591-5929f13cf265" />
            </div>
        </section>

      </main>

      <footer className="border-t border-border bg-secondary">
        <div className="container mx-auto px-6 py-8 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} StorePilot. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
    </>
  );
};

export default LandingPage;