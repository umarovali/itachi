import { Link } from "react-router-dom";
import type { Game } from "../data/games";
import { trText, useI18n } from "../lib/i18n";
import { IconArrow } from "./Icons";

export default function GameCard({ game }: { game: Game }) {
  useI18n(); // перерисовка при смене языка
  return (
    <Link className={`game-card game-card--${game.accent}`} to={`/${game.slug}`} title={trText(game.description)}>
      {/* Необязательное фото-обложка: положите файл в web/public/covers/<slug>.jpg */}
      <span className="game-card__cover" style={{ backgroundImage: `url(/covers/${game.slug}.jpg)` }} />
      <span className="game-card__icon">
        <img src={game.iconUrl} alt={game.title} loading="lazy" />
      </span>
      <span className="game-card__foot">
        <strong>{game.title}</strong>
        <span className="game-card__arrow" aria-hidden="true"><IconArrow size={16} /></span>
      </span>
    </Link>
  );
}
