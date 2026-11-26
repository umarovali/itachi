import { WINTER_THEME } from "../config";

const img = (name: string) => `/winter/${name}.webp`;

/** Снеговик внутри баннера */
export function WinterHero() {
  if (!WINTER_THEME) return null;
  return (
    <img className="winter-hero__snowman" src={img("snowman")} alt="" aria-hidden="true" width={210} height={221} loading="lazy" />
  );
}

/** Сугроб вдоль нижней кромки баннера (снаружи, чтобы выступал за рамку) */
export function WinterEdge() {
  if (!WINTER_THEME) return null;
  return <span className="winter-edge" aria-hidden="true" />;
}

/** Слой украшений по краям страницы: ёлки, подарки, сугробы */
export default function WinterDecor() {
  if (!WINTER_THEME) return null;
  return (
    <div className="winter-decor" aria-hidden="true">
      <img className="wd wd--branch" src={img("tree-big")} alt="" />
      <img className="wd wd--tree-right" src={img("tree-small")} alt="" />
      <img className="wd wd--tree-left" src={img("tree-big")} alt="" loading="lazy" />
      <img className="wd wd--gifts-mid" src={img("gifts-left")} alt="" loading="lazy" />
      <img className="wd wd--tree-bl" src={img("tree-big")} alt="" loading="lazy" />
      <img className="wd wd--gifts-bl" src={img("gifts-left")} alt="" loading="lazy" />
      <img className="wd wd--gifts-br2" src={img("gifts-left")} alt="" loading="lazy" />
      <img className="wd wd--gifts-br" src={img("gifts-right")} alt="" loading="lazy" />
      <span className="winter-decor__snow" />
    </div>
  );
}
