/** Late responses cannot restore private content after a session/view changes. */
export class VisibilityScope {
  private revision = 0;
  private visible = true;
  invalidate() {
    this.revision += 1;
  }
  setVisible(value: boolean) {
    if (value !== this.visible) this.invalidate();
    this.visible = value;
  }
  checkpoint() {
    const revision = this.revision;
    return () => this.visible && this.revision === revision;
  }
}
