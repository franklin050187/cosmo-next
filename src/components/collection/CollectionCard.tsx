import Link from "next/link";

interface CollectionSummary {
  id: number;
  owner: string;
  title: string;
  description: string;
  ship_count: number | null;
  created_at: string;
}

interface Props {
  collection: CollectionSummary;
}

export default function CollectionCard({ collection }: Props) {
  return (
    <Link
      href={`/collections/${collection.id}`}
      className="block border border-[#1C598C] rounded-md bg-[#021526]/65 backdrop-blur p-4 hover:border-cyan-400/40 transition-colors"
    >
      <h3 className="text-white font-semibold text-lg truncate">
        {collection.title}
      </h3>
      {collection.description && (
        <p className="text-blue-200 text-sm mt-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: collection.description }} />
      )}
      <div className="flex items-center justify-between mt-3 text-xs text-blue-300">
        <span>by {collection.owner}</span>
        <span>
          {collection.ship_count ?? 0} ship{(collection.ship_count ?? 0) !== 1 ? "s" : ""}
        </span>
      </div>
    </Link>
  );
}
