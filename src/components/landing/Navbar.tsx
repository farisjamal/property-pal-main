import { useState } from "react";
import { Menu, X, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const navLinks = [{
  label: "Properties",
  href: "#properties"
}, {
  label: "How It Works",
  href: "#features"
}, {
  label: "About",
  href: "#about"
}, {
  label: "Contact",
  href: "#contact"
}];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  return <nav className="fixed top-6 left-1/2 -translate-x-1/2 w-[95%] max-w-6xl z-50 bg-background/95 backdrop-blur-md shadow-lg rounded-full border border-border">
      <div className="px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-primary">
            <div className="bg-primary/10 p-2 rounded-full">
              <Home className="w-5 h-5 text-primary" />
            </div>
            PropertyBook
          </Link>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link, index) => <a key={link.label} href={link.href} className={`text-[15px] font-medium transition-colors border-b-2 py-1 ${index === 0 ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`}>
                {link.label}
              </a>)}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost" className="rounded-full px-6 font-medium">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button className="bg-primary hover:opacity-90 text-primary-foreground rounded-full px-7 font-medium h-10">
                Book a Viewing
              </Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden p-2 text-foreground" onClick={() => setIsOpen(!isOpen)} aria-label="Toggle menu">
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile navigation */}
        {isOpen && <div className="md:hidden py-4 border-t border-border animate-fade-in pb-4">
            <div className="flex flex-col gap-4 text-center">
              {navLinks.map(link => <a key={link.label} href={link.href} className="text-muted-foreground hover:text-foreground transition-colors font-medium py-2" onClick={() => setIsOpen(false)}>
                  {link.label}
                </a>)}
              <div className="flex flex-col gap-3 pt-2 px-4">
                <Link to="/auth" onClick={() => setIsOpen(false)}>
                  <Button variant="outline" className="w-full rounded-full font-medium h-10">
                    Sign In
                  </Button>
                </Link>
                <Link to="/auth" onClick={() => setIsOpen(false)}>
                  <Button className="w-full bg-primary hover:opacity-90 text-primary-foreground rounded-full font-medium h-10">
                    Book a Viewing
                  </Button>
                </Link>
              </div>
            </div>
          </div>}
      </div>
    </nav>;
};
export default Navbar;