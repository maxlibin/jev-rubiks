declare module 'cubejs' {
  class Cube {
    constructor();
    /** Builds the pruning tables; takes a few hundred ms to a few seconds. Call once. */
    static initSolver(): void;
    static fromString(facelets: string): Cube;
    /** Applies a space-separated algorithm such as "R U R' U'". */
    move(algorithm: string): Cube;
    asString(): string;
    isSolved(): boolean;
    /** Requires initSolver(). Returns a space-separated algorithm; "" when already solved. */
    solve(maxDepth: number): string;
  }
  export = Cube;
}
