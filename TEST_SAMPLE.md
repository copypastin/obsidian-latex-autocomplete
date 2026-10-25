# LaTeX Autocomplete Test Note

Copy and paste this content into any note in Obsidian to test the plugin.

---

## 1. Inline Math Tests (`$...$`)

Place your cursor inside the dollar signs and type `\` followed by the suggested keys:

- **Greek Letters:**
  - Type `$\` then `al` $\to$ select `\alpha` and press `Tab`
  - Type `$\` then `beta` $\to$ select `\beta` and press `Tab`
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
