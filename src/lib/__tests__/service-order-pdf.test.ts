import { describe, expect, it } from "vitest";
import { buildServiceOrderPdfValues } from "../service-order-pdf";

describe("service-order PDF values", () => {
  it("prints the receipt equipment condition in the Estado field", () => {
    const values = buildServiceOrderPdfValues(
      {
        order_number: "47720",
        created_at: "2026-07-19T12:00:00.000Z",
        reported_fault: "Does not power on",
        received_accessories: "Power cable",
        equipment_condition: "Scratched screen and dent on the left side",
        customers: { name: "Test Customer", phone1: "555-0100", address: "San José" },
        equipment: {
          type: "Laptop",
          brand: "Example",
          model: "Model A",
          serial_number: "SERIAL-001",
        },
      },
      0,
    );

    expect(values.state).toBe("Scratched screen and dent on the left side");
  });
});
