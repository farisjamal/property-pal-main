import { Home, Mail, Phone, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

const footerLinks = {
  Platform: ["Browse Properties", "Book Viewings", "List Property"],
  Company: ["About Us", "Contact", "Blog"],
  Support: ["Help Center", "FAQs", "Feedback"],
  Legal: ["Privacy Policy", "Terms of Service"],
};

const Footer = () => {
  return (
    <footer className="border-t border-border/50 bg-secondary/20">
      <div className="container px-4 py-14">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          {/* Brand column */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2.5 mb-4 group">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                <Home className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display text-xl font-semibold tracking-tight">PropertyPal</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[16rem] mb-6">
              Malaysia's trusted platform for finding rental properties and booking viewings with ease.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>hello@propertybook.my</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>+60 3-1234 5678</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Kuala Lumpur, Malaysia</span>
              </div>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground mb-4">
                {category}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <Link
                      to="/auth"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © 2026 PropertyPal. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Built with care for the Malaysian rental market.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
