import Embers from "../../components/Embers";
import GameCard from "../../components/GameCard";
import SharinganLogo from "../../components/SharinganLogo";
import { games } from "../../data/games";

export default function Home() {
  return (
    <div className="home page-transition">
      <section className="home__hero">
        <Embers />
        <SharinganLogo size={640} className="home__bg-sharingan" />
        <div className="home__hero-copy">
          <span className="eyebrow">ITACHI STORE / GAME TOP-UP</span>
          <h1>
            Пополняй игры
            <br />
            <span>без лишних шагов.</span>
          </h1>
          <p>Один магазин для популярных игр. Выбирай игру, пакет и отправляй заявку — всё в одном понятном интерфейсе.</p>
          <div className="home__chips">
            <span>O!Bank и Элкарт QR</span>
            <span>Сом · Рубль · Тенге · Сум</span>
            <span>24/7 приём</span>
          </div>
        </div>
      </section>

      <section className="home__games">
        <div className="section-head">
          <div>
            <span className="eyebrow">Игры</span>
            <h2>Выбери игру</h2>
          </div>
          <p>Пополнение по ID игрока — без логина и пароля.</p>
        </div>
        <div className="home__grid">
          {games.map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </div>
      </section>

      <section className="home__how">
        <span className="eyebrow">Как это работает</span>
        <h2>Игра → пакет → данные → оплата</h2>
        <div className="home__steps">
          <div>
            <b>01</b>
            <span>Выбери игру и пакет</span>
          </div>
          <div>
            <b>02</b>
            <span>Укажи UID / ID игрока</span>
          </div>
          <div>
            <b>03</b>
            <span>Оплати через QR</span>
          </div>
          <div>
            <b>04</b>
            <span>Получи пополнение</span>
          </div>
        </div>
      </section>
    </div>
  );
}
