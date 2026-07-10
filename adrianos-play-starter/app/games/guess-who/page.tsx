import Link from "next/link";
import GameFrame from "@/components/GameFrame";

export default function GuessWhoPage() {
  return (
    <GameFrame title="Guess Who">
      <div className="import-panel">
        <div className="import-icon">🕵️</div>
        <span className="eyebrow">NEXT INTEGRATION</span>
        <h1>Move the existing Guess Who game here.</h1>
        <p>
          Its final home will be <code>/games/guess-who</code>, with the same
          full-screen frame, a reliable Home button, correctly cropped secret
          cards, and tap-to-flip elimination.
        </p>
        <div className="import-checklist">
          <span>✓ Portrait-safe image sizing</span>
          <span>✓ One close button in the top-right</span>
          <span>✓ Tap cards to flip them down</span>
          <span>✓ Clean end screen at every screen size</span>
        </div>
        <Link href="/" className="primary-button inline-button">Back to library</Link>
      </div>
    </GameFrame>
  );
}
