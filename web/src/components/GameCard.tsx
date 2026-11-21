import { Link } from "react-router-dom";
import type { Game } from "../data/games";

export default function GameCard({ game }: { game: Game }) {
  return (
    <Link className={`game-card game-card--${game.accent}`} to={`/${game.slug}`}>
      <span className="game-card__icon">
        <img src={game.iconUrl} alt={`${game.title} — иконка игры`} loading="lazy" />
      </span>
      <span className="game-card__body">
        <strong>{game.title}</strong>
        <small>{game.description}</small>
      </span>
      <span className="game-card__arrow" aria-hidden="true">→</span>
    </Link>
  );
}
