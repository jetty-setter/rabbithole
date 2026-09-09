/**
 * The quiet line under the hero: what RabbitHole is, in two sentences. Plain
 * editorial prose, with no steps, card, rule, or heading flourish. Hierarchy
 * is the lead line's size against the body line.
 */
export function HomeAbout() {
  return (
    <section className="home-about" aria-label="What RabbitHole is">
      <p className="home-about-lead">RabbitHole is built to be wandered.</p>
      <p className="home-about-body">
        Short, sourced pieces, one subject at a time. Start with one, open a
        connection, and keep going.
      </p>
    </section>
  );
}
