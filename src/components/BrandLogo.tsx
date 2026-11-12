// Logotipo unificado do SlideAI. Usa /logo.png (servido do public/), com
// wordmark opcional. Substitui o antigo par "quadradinho gradiente + Sparkles".
interface Props {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  /** Classes do nome escrito (ex.: esconder em telas muito estreitas). */
  wordmarkClassName?: string;
}

export const BrandLogo = ({ size = 36, showWordmark = true, className = "", wordmarkClassName = "" }: Props) => {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src="/logo.png"
        // Com o nome escrito ao lado, a imagem é decorativa (antes o leitor de tela lia "SlideAI SlideAI").
        alt={showWordmark ? "" : "SlideAI"}
        width={size}
        height={size}
        className="rounded-xl object-contain"
        style={{ width: size, height: size }}
        loading="eager"
        decoding="async"
      />
      {showWordmark && (
        <span className={`font-display text-xl font-bold tracking-tight ${wordmarkClassName}`}>SlideAI</span>
      )}
    </span>
  );
};
