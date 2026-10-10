import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PLAN_PRICES } from "@/lib/cakto";

export const CTA = () => {
  return (
    <section className="py-12 sm:py-16 lg:py-20">
      <div className="container mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-hero px-5 py-8 sm:p-10 lg:p-12 text-center shadow-elegant"
        >


          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 backdrop-blur px-4 py-1.5 text-sm font-medium text-primary-foreground mb-6 border border-primary-foreground/20">
              <Sparkles className="h-3.5 w-3.5" />
              Pronto para começar?
            </div>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-primary-foreground max-w-3xl mx-auto leading-[1.1]">
              Sua próxima apresentação está a um prompt de distância.
            </h2>
            <p className="mt-5 text-lg text-primary-foreground/85 max-w-xl mx-auto">
              Crie hoje sua primeira apresentação com IA, a partir de {PLAN_PRICES.single}.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/gerar">
                <Button size="xl" className="w-full sm:w-auto px-5 sm:px-9 bg-background text-primary hover:bg-background/90 group">
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
