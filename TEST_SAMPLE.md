# LaTeX Autocomplete Test Note

Copy and paste this content into any note in Obsidian to test the plugin.

---

## 1. Inline Math Tests (`$...$`)

Place your cursor inside the dollar signs and type `\` followed by the suggested keys:

- **Greek Letters:**
  - Type `$\` then `al` $\to$ select `\alpha` and press `Tab`
  - Type `$\` then `bet` $\to$ select `\beta` and press `Tab`
  - Result: $\alpha + \beta$

- **Fractions & Cursor Placement:**
  - Type `$\` then `fr` $\to$ select `\frac` and press `Tab`.
  - Notice the cursor lands **inside the first `{}`**: `\frac{CURSOR}{}`.
  - Type `1`, move to the second braces, and type `2`.
  - Result: $\frac{1}{2}$

- **Roots & Integrals:**
  - Type `$\` then `sq` $\to$ select `\sqrt` and press `Tab`.
  - Type `$\` then `int` $\to$ select `\int` and press `Tab`.

---

## 2. Multi-Line Display Math Tests (`$$...$$`)

Place your cursor between the `$$` lines and try these:

$$
\frac{a}{b} = \lim_{x \to 0} \frac{\sin(x)}{x}
$$

### Try typing this block step-by-step:

$$
\int_{0}^{\infty} e^{-x^2} \, dx = \frac{\sqrt{\pi}}{2}
$$

1. Type `$$` and press `Enter`.
2. Type `\in` $\to$ select `\int` and press `Tab`.
3. Type `0` inside the subscript `_{}`, then `\inf` $\to$ `\infty` for superscript.
4. Type `e^{-x^2} \, dx = `
5. Type `\fr` $\to$ `\frac` $\to$ `\sq` $\to$ `\sqrt{\pi}` over `2`.

---

## 3. Linear Algebra & Matrices

For a 3×3 matrix, choose `\begin{bmatrix} 3x3` or `\begin{pmatrix} 3x3`. Type each cell's value and press **Tab** to move across the row and into the next row. **Shift+Tab** returns to the previous cell and selects its value for replacement. After the ninth cell, **Tab** moves past `\end{...}`. The same input navigation works with fractions, roots, integrals, and equation environments; **Esc** ends it.

$$
A = \begin{pmatrix}
a & b \\
c & d
\end{pmatrix}, \quad \det(A) = ad - bc
$$

Try typing:

- `\pmat` $\to$ select `\begin{pmatrix}`
- `\det` $\to$ select `\det`
- `\diag` $\to$ select `\operatorname{diag}`
- `\span` $\to$ select `\operatorname{span}`

---

## 4. Fuzzy Search by Description (English Words)

You don't need to know the exact LaTeX syntax. Type `\` and search using plain English:

| Type this after `\` | Suggested Command | Description                       |
| :------------------ | :---------------- | :-------------------------------- |
| `\fraction`         | `\frac`           | Fraction                          |
| `\integral`         | `\int`            | Integral                          |
| `\summation`        | `\sum`            | Summation                         |
| `\infinity`         | `\infty`          | Infinity symbol                   |
| `\partial`          | `\partial`        | Partial derivative                |
| `\square`           | `\sqrt`           | Square root                       |
| `\variance`         | `\Var`            | Variance                          |
| `\covariance`       | `\Cov`            | Covariance                        |
| `\curl`             | `\curl`           | Curl ($\nabla \times \mathbf{F}$) |

---

## 5. Negative Cases (Should NOT trigger Autocomplete)

Verify that autocomplete stays hidden outside math contexts:

1. **Plain text:**
   - Type `\frac` or `\alpha` here outside math: nothing should pop up.
2. **Escaped dollar signs:**
   - The price was \$50 and total was \$100 \frac $\to$ no popup after `\frac`.
3. **Inline code blocks:**
   - Here is inline code: `const $var = \frac{1}{2};` $\to$ no popup inside backticks.
4. **Non-math code blocks:**
   ```python
   # Inside Python code block
   \alpha = 10
   $x = 20
   ```
   $\to$ no popup inside Python code blocks.

---

## 6. Math Code Block Test (`math`)

```math
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
```

Inside this `math` code block, type `\` and autocomplete should trigger with full previews!

---

## 7. LaTeX Suite Compatibility

Enable LaTeX Suite and try these in Live Preview and Source mode:

1. Inside `$...$`, type Suite's `Ome` shortcut. It should expand to `\Omega` and the suggestion menu should close. Press Tab or Enter: the capital `O` must stay unchanged.
2. Repeat with `ome`, and confirm it stays `\omega`. Also try capital / lowercase Gamma, Delta, Theta, Sigma, and arrows such as `\Rightarrow` / `\rightarrow`.
3. Type `\Om` directly: the first suggestion should be `\Omega`. Type `\om`: it should be `\omega`, even if you have used the other version frequently.
4. After a completed `\Omega`, press Ctrl+Space to deliberately request alternatives. The first suggestion should still preserve its capitalization.
5. Start a fraction using Suite's `//` snippet. In its numerator, use autocomplete to insert another `\frac`. Fill the inner numerator and denominator, then continue with Tab into the outer denominator. The expected result is `\frac{\frac{a}{b}}{c}`.
6. Insert a 3×3 matrix using autocomplete. Fill all nine cells with Tab, use Shift+Tab to replace a filled cell, and confirm Tab leaves the matrix after the ninth cell.
7. Press Esc with the menu closed while filling an autocomplete template. Its input navigation should end. An independent Suite snippet should keep Suite's usual Escape behavior.
