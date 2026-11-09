export interface FoodSuggestion {
    id: string;
    name: string;
    vendorName: string;
    image: string;
    price: number;
    matchIndex: number;
}

export interface SuggestableFood {
    id: string;
    name: string;
    vendorName: string;
    image: string;
    discountedPrice: number;
    slug?: string;
    rawId?: string;
}

export function suggestFoods<T extends SuggestableFood>(items: T[], query: string, limit = 6): FoodSuggestion[] {
    const needle = query.trim().toLowerCase();
    if (!needle)
        return [];
    const scored: {
        item: T;
        index: number;
    }[] = [];
    for (const item of items) {
        const index = item.name.toLowerCase().indexOf(needle);
        if (index < 0)
            continue;
        scored.push({ item, index });
    }
    scored.sort((a, b) => a.index - b.index || a.item.name.localeCompare(b.item.name, 'id'));
    return scored.slice(0, Math.max(0, limit)).map(({ item, index }) => ({
        id: item.slug ?? item.rawId ?? item.id,
        name: item.name,
        vendorName: item.vendorName,
        image: item.image,
        price: item.discountedPrice,
        matchIndex: index,
    }));
}
