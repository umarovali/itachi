import sharinganImg from "../assets/sharingan-mangekyo.png";

interface Props {
  size?: number;
  awaken?: boolean;
  spinning?: boolean;
  className?: string;
}

export default function SharinganLogo({ size = 64, awaken = false, spinning = true, className = "" }: Props) {
  return (
    <img
      src={sharinganImg}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`sharingan ${spinning ? "sharingan--spin" : ""} ${awaken ? "sharingan--awaken" : ""} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
