import { Navigate, useParams } from "react-router-dom";
import GameStore from "../components/GameStore";
import { findGame } from "../data/games";

export default function GamePage() {
  const { slug } = useParams();
  const game = findGame(slug);
  if (!game) return <Navigate to="/" replace />;
  return (
    <div className={`page--${game.slug}`} key={game.slug}>
      <GameStore game={game} />
    </div>
  );
}
