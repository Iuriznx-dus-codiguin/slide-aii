import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const CTA = () => {
  return (
    <section className="py-24 md:py-32">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-hero p-10 md:p-16 text-center shadow-elegant"
        >
          {/* decorative orbs */}
          <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-accent/30 blur-3xl" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-4 py-1.5 text-sm font-medium text-white mb-6 border border-white/20">
              <Sparkles className="h-3.5 w-3.5" />
              Pronto para começar?
            </div>
            <h2 className="font-display text-4xl md:text-6xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-[1.1]">
              Sua próxima apresentação está a um prompt de distância.
            </h2>
            <p className="mt-5 text-lg text-white/85 max-w-xl mx-auto">
              Crie hoje sua primeira apresentação com IA. Pré-visualize gratuitamente.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/gerar">
                <Button size="xl" className="bg-white text-primary hover:bg-white/90 group">
                  Criar minha apresentação
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
