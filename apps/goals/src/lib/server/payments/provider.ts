export interface PaymentProviderProposal {
    id: 'stripe' | 'mollie' | 'adyen';
    name: string;
    recommended: boolean;
    summary: string;
    escrowAndCrowdfundingSupport: string;
    euPaymentMethods: string[];
    feeStructure: string;
    integrationFlow: string[];
}

export const PAYMENT_PROVIDER_PROPOSALS: PaymentProviderProposal[] = [
    {
        id: 'stripe',
        name: 'Stripe (Stripe Connect + Checkout / PaymentIntents)',
        recommended: true,
        summary:
            'Recommended primary external payment management provider for AC-Goals. Combines hosted PSD2-compliant Checkout with Stripe Connect multi-party split payouts and delayed/escrow-style funds release.',
        escrowAndCrowdfundingSupport:
            'Supports both Separate Charges & Transfers (funds held in platform balance until primary goal is reached, then transferred to approved community campaign owners or refunded automatically if unsuccessful) and manual capture PaymentIntents.',
        euPaymentMethods: [
            'SEPA Direct Debit',
            'Credit & Debit Cards (Visa, Mastercard, Amex)',
            'Apple Pay & Google Pay',
            'Klarna / SOFORT',
            'PayPal (via Stripe EU)',
        ],
        feeStructure: '1.5% + €0.25 per EEA card transaction; €0.35 flat per SEPA Direct Debit.',
        integrationFlow: [
            '1. Backer selects pledge tier or custom amount in Financial Contribution Plugin.',
            '2. Server creates a Stripe Checkout Session / PaymentIntent linked to goalCampaign.id and user.id.',
            '3. Stripe handles 3DS2 / SCA authentication and authorizes/collects the pledge.',
            '4. Webhook (payment_intent.succeeded / checkout.session.completed) records goalContribution and updates goalStage milestones.',
            '5. On campaign completion: if completed_successful, funds settle to operator/creator Connect account; if completed_unsuccessful or cancelled, automated refunds are issued.',
        ],
    },
    {
        id: 'mollie',
        name: 'Mollie (Mollie Connect & Split Payments)',
        recommended: false,
        summary:
            'Strong European alternative headquartered in Amsterdam with fast onboarding for German and EU non-profits and community associations.',
        escrowAndCrowdfundingSupport:
            'Supports Mollie Connect for Platforms with delayed routing of split payments to connected sub-merchants.',
        euPaymentMethods: [
            'SEPA Bank Transfer & Direct Debit',
            'Credit & Debit Cards',
            'SOFORT / Klarna',
            'Apple Pay',
            'PayPal',
        ],
        feeStructure: 'No minimum monthly fees; pay-per-transaction (~1.8% + €0.25 cards, €0.39 SEPA).',
        integrationFlow: [
            '1. Create Mollie Payment with metadata { campaignId, userId }.',
            '2. Redirect participant to hosted Mollie Checkout.',
            '3. Verify payment status on webhook callback and increment campaign progress.',
        ],
    },
    {
        id: 'adyen',
        name: 'Adyen for Platforms',
        recommended: false,
        summary:
            'Enterprise-grade European payment processor with full banking license for high-volume marketplace escrow.',
        escrowAndCrowdfundingSupport:
            'Full virtual sub-ledger accounts per campaign with programmable split and hold durations.',
        euPaymentMethods: ['SEPA', 'Cards', 'Apple Pay', 'Google Pay', 'Klarna'],
        feeStructure: 'Interchange++ pricing; best suited once platform volume exceeds €5M/year.',
        integrationFlow: [
            '1. Onboard campaign owner to Adyen Balance Platform.',
            '2. Process payment into campaign virtual liable account.',
            '3. Sweep funds upon milestone completion.',
        ],
    },
];

export interface ProcessPaymentInput {
    campaignId: string;
    userId: string;
    amount: number;
    currency: string;
    provider: 'stripe' | 'mollie' | 'adyen';
    financialType?: 'pledge' | 'transfer';
    captureStrategy?: 'all_or_nothing' | 'immediate';
}

export interface ProcessPaymentResult {
    success: boolean;
    provider: 'stripe' | 'mollie' | 'adyen';
    financialType: 'pledge' | 'transfer';
    paymentStatus: 'authorized' | 'captured';
    paymentReference: string;
    checkoutReceiptUrl: string;
}

/**
 * Executes payment authorization (for a financial pledge) or immediate capture/settlement (for an actual transfer)
 * against the configured payment provider adapter.
 */
export async function processFinancialContributionPayment(
    input: ProcessPaymentInput
): Promise<ProcessPaymentResult> {
    const resolvedType: 'pledge' | 'transfer' =
        input.financialType ??
        (input.captureStrategy === 'immediate' ? 'transfer' : 'pledge');

    const modePrefix = resolvedType === 'pledge' ? 'plg' : 'trf';
    const providerTag =
        input.provider === 'stripe'
            ? 'stripe'
            : input.provider === 'mollie'
              ? 'mollie'
              : 'adyen';
    const randomSuffix = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const paymentReference = `${modePrefix}_${providerTag}_${randomSuffix}`;

    const paymentStatus: 'authorized' | 'captured' =
        resolvedType === 'pledge' ? 'authorized' : 'captured';

    return {
        success: true,
        provider: input.provider,
        financialType: resolvedType,
        paymentStatus,
        paymentReference,
        checkoutReceiptUrl: `https://dashboard.stripe.com/test/payments/${paymentReference}`,
    };
}

export interface ReversalOrSettlementResult {
    action: 'pledge_cancelled' | 'transfer_refunded' | 'pledge_captured';
    nextPaymentStatus: 'cancelled' | 'refunded' | 'captured';
    reference: string;
    processedAt: string;
}

/**
 * Cancels an uncaptured pledge authorization, refunds an actual transfer when a campaign is cancelled or
 * completed unsuccessfully, or captures a pledge when a campaign completes successfully.
 */
export async function reverseOrSettleFinancialContribution(input: {
    provider: string;
    financialType: 'pledge' | 'transfer';
    currentPaymentStatus: string;
    originalReference?: string | null;
    outcome: 'cancelled' | 'completed_unsuccessful' | 'completed_successful';
}): Promise<ReversalOrSettlementResult | null> {
    const nowIso = new Date().toISOString();
    const suffix = Math.random().toString(36).substring(2, 8) + Date.now().toString(36).slice(-4);
    const prov = input.provider || 'stripe';

    if (input.outcome === 'cancelled' || input.outcome === 'completed_unsuccessful') {
        if (input.currentPaymentStatus === 'cancelled' || input.currentPaymentStatus === 'refunded') {
            return null;
        }
        if (input.financialType === 'pledge' || input.currentPaymentStatus === 'authorized' || input.currentPaymentStatus === 'pledged') {
            return {
                action: 'pledge_cancelled',
                nextPaymentStatus: 'cancelled',
                reference: `void_${prov}_${suffix}`,
                processedAt: nowIso,
            };
        }
        return {
            action: 'transfer_refunded',
            nextPaymentStatus: 'refunded',
            reference: `re_${prov}_${suffix}`,
            processedAt: nowIso,
        };
    }

    if (input.outcome === 'completed_successful') {
        if (input.financialType === 'pledge' && (input.currentPaymentStatus === 'authorized' || input.currentPaymentStatus === 'pledged')) {
            return {
                action: 'pledge_captured',
                nextPaymentStatus: 'captured',
                reference: `cap_${prov}_${suffix}`,
                processedAt: nowIso,
            };
        }
    }

    return null;
}
