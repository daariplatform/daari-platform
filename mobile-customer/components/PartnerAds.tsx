import { View, Text, Pressable, Linking, Alert } from 'react-native';

// In production these come from the backend `/ads/feed` endpoint with
// neighbourhood targeting. For MVP we ship a static fallback.
const FALLBACK_ADS = [
  { id: 'a1', advertiser: 'غاز الأمين', title: 'توصيل غاز منزلي', body: 'أسطوانة ١٢ كغ — يصلك خلال ساعة', emoji: '🔥', color: 'bg-orange-500' },
  { id: 'a2', advertiser: 'تنظيف خزانات الصفا', title: 'تنظيف خزان الماء', body: 'خصم ٢٠٪ لزبائن ماء — احجز اليوم', emoji: '🧹', color: 'bg-sky-500' },
];

interface Props {
  ads?: typeof FALLBACK_ADS;
  onClick?: (id: string) => void;
}

export function PartnerAds({ ads = FALLBACK_ADS, onClick }: Props) {
  if (!ads.length) return null;
  return (
    <View className="mt-4">
      <View className="flex-row justify-between items-center px-1 mb-2">
        <Text className="text-xs font-bold text-slate-600">خدمات شركاء قريبة منك</Text>
        <Text className="text-[10px] text-slate-400">⚙️ إخفاء</Text>
      </View>
      {ads.map((a) => (
        <Pressable
          key={a.id}
          onPress={() => onClick?.(a.id)}
          className="bg-white rounded-2xl shadow-sm overflow-hidden flex-row mb-2"
        >
          <View className={`w-16 ${a.color} items-center justify-center`}>
            <Text className="text-3xl">{a.emoji}</Text>
          </View>
          <View className="flex-1 p-3 flex-row items-center gap-2">
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="font-bold text-sm" numberOfLines={1}>
                  {a.title}
                </Text>
                <Text className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-bold">
                  إعلان
                </Text>
              </View>
              <Text className="text-[11px] text-slate-500" numberOfLines={1}>
                {a.body}
              </Text>
              <Text className="text-[10px] text-aqua-700 font-bold mt-0.5">{a.advertiser}</Text>
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
