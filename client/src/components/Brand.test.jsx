import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Brand from "./Brand.jsx";
import { renderWithRouter } from "../test/test-utils.jsx";

describe("Brand", () => {
  it("renderiza el enlace de inicio de BuscaCampus", () => {
    renderWithRouter(<Brand />);

    expect(
      screen.getByRole("link", { name: "BuscaCampus, ir al inicio" }),
    ).toHaveAttribute("href", "/");
  });
});
