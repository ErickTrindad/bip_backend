export const RETENTION_DAYS_BY_PLAN = {
    FREE: 30,
    PRO: 90,
    PREMIUM: 365,
};
/**
 * Retorna a data mínima permitida (cutoffDate) para consulta histórica de vendas e relatórios
 * baseada no plano do tenant.
 *
 * FREE: últimos 30 dias
 * PRO: últimos 90 dias
 * PREMIUM: últimos 365 dias (1 ano)
 */
export function getPlanRetentionDays(plan = 'FREE') {
    return RETENTION_DAYS_BY_PLAN[plan] ?? 30;
}
/**
 * Calcula a data de corte (cutoffDate) retroativa baseada no plano do tenant.
 */
export function calculatePlanCutoffDate(plan = 'FREE', referenceDate = new Date()) {
    const days = getPlanRetentionDays(plan);
    const cutoff = new Date(referenceDate.getTime());
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);
    return cutoff;
}
/**
 * Valida e normaliza o intervalo de datas (startDate, endDate) respeitando o limite do plano do tenant.
 * Se startDate for omitido ou anterior à data de corte do plano, ele é limitado à cutoffDate.
 */
export function normalizeDateRangeForPlan(plan = 'FREE', requestedStartDate, requestedEndDate, referenceDate = new Date()) {
    const planCutoffDate = calculatePlanCutoffDate(plan, referenceDate);
    const maxDaysAllowed = getPlanRetentionDays(plan);
    const endDate = requestedEndDate ? new Date(requestedEndDate) : new Date(referenceDate);
    let startDate;
    if (requestedStartDate) {
        const parsedStart = new Date(requestedStartDate);
        // Se o cliente solicitou uma data mais antiga que o plano permite, corta na data limite do plano
        startDate = parsedStart < planCutoffDate ? planCutoffDate : parsedStart;
    }
    else {
        startDate = planCutoffDate;
    }
    // Garante que startDate <= endDate
    if (startDate > endDate) {
        startDate = new Date(endDate.getTime() - (maxDaysAllowed * 24 * 60 * 60 * 1000));
    }
    return {
        startDate,
        endDate,
        planCutoffDate,
        maxDaysAllowed,
    };
}
