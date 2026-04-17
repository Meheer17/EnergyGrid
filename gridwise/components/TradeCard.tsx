"use client";

type TradeOfferCard = {
    id: string;
    city: string;
    energyAmount_kWh: number;
    pricePerUnit_INR: number;
    billSplit_INR: number;
    status: string;
};

type TradeCardProps = {
    offer: TradeOfferCard;
    onAccept?: (offerId: string) => Promise<void>;
    accepting?: boolean;
};

export default function TradeCard({ offer, onAccept, accepting = false }: TradeCardProps) {
    return (
        <article className="rounded-xl border border-white/10 bg-[#0d1016] p-4 shadow-[0_0_0_1px_rgba(0,229,255,0.08)]">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/70">{offer.status}</p>
                    <h3 className="mt-1 text-lg font-semibold text-white">Seller in {offer.city}</h3>
                </div>
                <span className="rounded-full border border-white/20 px-2 py-1 text-xs text-white/70">#{offer.id.slice(-6)}</span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm text-white/80">
                <div>
                    <dt className="text-white/50">Energy</dt>
                    <dd className="font-medium text-white">{offer.energyAmount_kWh.toFixed(2)} kWh</dd>
                </div>
                <div>
                    <dt className="text-white/50">Price/unit</dt>
                    <dd className="font-medium text-white">INR {offer.pricePerUnit_INR.toFixed(2)}</dd>
                </div>
                <div className="col-span-2">
                    <dt className="text-white/50">Bill split</dt>
                    <dd className="text-xl font-semibold text-cyan-300">INR {offer.billSplit_INR.toFixed(2)}</dd>
                </div>
            </dl>

            {onAccept && (
                <button
                    onClick={() => onAccept(offer.id)}
                    disabled={accepting}
                    className="mt-4 w-full rounded-lg bg-cyan-400 px-3 py-2 font-medium text-slate-900 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-65"
                >
                    {accepting ? "Accepting..." : "Accept Offer"}
                </button>
            )}
        </article>
    );
}
