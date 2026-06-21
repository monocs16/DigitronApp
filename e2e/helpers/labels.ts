/** Spanish UI copy — app default/fallback locale for E2E (see src/lib/i18n.ts). */
export const labels = {
  common: {
    name: "Nombre",
    save: "Guardar",
    cancel: "Cancelar",
  },
  stage: {
    intake: "Recepción",
    evaluation: "Evaluación",
    budget: "Presupuesto",
    customer_decision: "Decisión del cliente",
    on_hold: "En espera",
    repair: "Reparación",
    payment: "Pago",
    delivered: "Entregado",
    closed: "Cerrado",
  },
  orders: {
    newOrder: "Nueva orden",
    createOrder: "Crear orden",
    problemReported: "Problema reportado",
    sendToEvaluation: "Enviar a evaluación",
    completeEvaluation: "Completar evaluación",
    sendToDecision: "Enviar decisión al cliente",
    closeOrder: "Cerrar orden",
    back: "Volver",
    stageUpdated: "Etapa actualizada",
    notFound: "Orden no encontrada.",
  },
  clients: {
    newClient: "Nuevo cliente",
  },
  equipment: {
    newEquipment: "Nuevo equipo",
    type: "Tipo",
    brand: "Marca",
    model: "Modelo",
  },
  form: {
    client: "Cliente",
    equipment: "Equipo",
  },
  sidebar: {
    users: "Usuarios",
    settings: "Configuración",
  },
  roles: {
    super: "Superusuario",
  },
  login: {
    signIn: "Ingresar",
  },
} as const;
