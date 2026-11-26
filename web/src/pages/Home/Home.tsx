import { Link } from "react-router-dom";
import GameCard from "../../components/GameCard";
import { GemCluster, IconArrow, IconBolt, IconGift, IconHeadset, IconShield } from "../../components/Icons";
import { games } from "../../data/games";
import { WinterEdge, WinterHero } from "../../components/Winter";
import Lines from "../../components/Lines";
import { useI18n } from "../../lib/i18n";

const CHANNEL = "https://t.me/+CupXqM_28Bc4Njky";

export default function Home() {
  const { t } = useI18n();
  return (
    <div className="home">
      <div className="hero-wrap">
      <section className="hero">
        <div className="hero__copy">
          <h1>
            FaaPay<span></span>
          </h1>
          <p className="hero__slogan">{t("hero.slogan")}</p>
          <p className="hero__sub">{t("hero.sub1")}<br />{t("hero.sub2")}</p>
          <div className="hero__actions">
            <a className="hero__cta" href="#games">
              <IconBolt size={18} /> {t("hero.cta")} <IconArrow size={18} />
            </a>
            <div className="hero__safe">
              <IconShield size={34} />
              <span><b>{t("hero.safe.title")}</b><small>{t("hero.safe.sub")}</small></span>
            </div>
          </div>
        </div>
        <GemCluster />
        <WinterHero />
      </section>
      <WinterEdge />
      </div>

      <section className="home__games" id="games">
        <div className="section-head">
          <h2>{t("home.games.title")}</h2>
          <p>{t("home.games.sub")}</p>
        </div>
        <div className="home__grid">
          {games.map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </div>
      </section>

      <section className="home__bottom">
        <div className="features">
          <div><span className="features__icon"><IconBolt size={24} /></span><b><Lines text={t("feat.1")} /></b></div>
          <div><span className="features__icon"><IconShield size={24} /></span><b><Lines text={t("feat.2")} /></b></div>
          <div><span className="features__icon"><IconHeadset size={24} /></span><b><Lines text={t("feat.3")} /></b></div>
          <div><span className="features__icon"><IconGift size={24} /></span><b><Lines text={t("feat.4")} /></b></div>
        </div>
        <div className="promo">
          <div>
            <h3><Lines text={t("promo.title")} /></h3>
            <a className="promo__btn" href={CHANNEL} target="_blank" rel="noreferrer">
              <IconGift size={16} /> {t("promo.btn")} <IconArrow size={16} />
            </a>
          </div>
          <IconGift size={92} />
        </div>
      </section>

      <section className="home__how">
        <h2>{t("how.title")}</h2>
        <div className="home__steps">
          <div><b>01</b><span>{t("how.1")}</span></div>
          <div><b>02</b><span>{t("how.2")}</span></div>
          <div><b>03</b><span>{t("how.3")}</span></div>
          <div><b>04</b><span>{t("how.4")}</span></div>
        </div>
        <Link className="home__order-link" to="/free-fire">{t("how.start")}</Link>
      </section>
    </div>
  );
}
