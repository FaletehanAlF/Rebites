export interface BrowseCategory {
    id: string;
    name: string;
    description: string;
    image: string;
}
export const CATEGORIES: BrowseCategory[] = [
    {
        id: "makanan-berat",
        name: "Makanan Berat",
        description: "Temukan nasi, lauk, dan hidangan hangat dari dapur UMKM di sekitarmu.",
        image: "https://images.pexels.com/photos/37081081/pexels-photo-37081081.jpeg?auto=compress&cs=tinysrgb&w=800",
    },
    {
        id: "jajanan",
        name: "Jajanan",
        description: "Cemilan klasik yang masih layak dinikmati sebelum stoknya habis.",
        image: "https://images.pexels.com/photos/37222830/pexels-photo-37222830.jpeg?auto=compress&cs=tinysrgb&w=800",
    },
    {
        id: "japanese",
        name: "Japanese",
        description: "Sushi dan masakan Jepang pilihan dengan harga lebih bersahabat.",
        image: "https://images.pexels.com/photos/36292346/pexels-photo-36292346.jpeg?auto=compress&cs=tinysrgb&w=800",
    },
    {
        id: "roti-kue",
        name: "Roti & Kue",
        description: "Roti dan kue dari toko roti yang belum sempat terjual hari ini.",
        image: "https://images.pexels.com/photos/5436437/pexels-photo-5436437.jpeg?auto=compress&cs=tinysrgb&w=800",
    },
    {
        id: "makanan-cepat-saji",
        name: "Makanan Cepat Saji",
        description: "Sajian cepat siap diselamatkan sebelum akhirnya terbuang sia-sia.",
        image: "https://images.pexels.com/photos/23091813/pexels-photo-23091813.jpeg?auto=compress&cs=tinysrgb&w=800",
    },
    {
        id: "dessert",
        name: "Dessert",
        description: "Manisan penutup yang masih layak dinikmati sebelum hari berakhir.",
        image: "https://images.pexels.com/photos/32916204/pexels-photo-32916204.jpeg?auto=compress&cs=tinysrgb&w=800",
    },
    {
        id: "buah-sayur",
        name: "Buah & Sayur",
        description: "Buah dan sayur segar surplus yang tetap berkualitas untuk dikonsumsi.",
        image: "https://images.pexels.com/photos/3987405/pexels-photo-3987405.jpeg?auto=compress&cs=tinysrgb&w=800",
    },
    {
        id: "minuman",
        name: "Minuman",
        description: "Kopi, teh, dan minuman segar yang perlu dinikmati hari ini juga.",
        image: "https://images.pexels.com/photos/8215110/pexels-photo-8215110.jpeg?auto=compress&cs=tinysrgb&w=800",
    },
];
export function getCategoryBySlug(slug: string): BrowseCategory | undefined {
    return CATEGORIES.find((category) => category.id === slug);
}
