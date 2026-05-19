"use client";

import { useTranslation } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, ShoppingBag, Crown } from "lucide-react";

interface PurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemTitle: string;
  itemPrice: number;
  contentId: string;
  contentType: string;
  contentTitleAr: string;
}

export function PurchaseDialog({
  open,
  onOpenChange,
  itemTitle,
  itemPrice,
  contentId,
  contentType,
  contentTitleAr,
}: PurchaseDialogProps) {
  const { t, locale } = useTranslation();
  const { navigate } = useAppStore();

  const displayPrice = itemPrice > 0 ? itemPrice : 0;

  const handleBuyNow = () => {
    onOpenChange(false);
    navigate("payment", {
      contentId,
      contentType,
      contentTitle: itemTitle,
      contentTitleAr,
      contentPrice: displayPrice,
    });
  };

  const handleSubscribe = () => {
    onOpenChange(false);
    navigate("subscriptions");
  };

  // If price is not set (free or invalid state), show subscribe-only dialog
  if (displayPrice <= 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-500" />
              {t("common.premiumContent")}
            </DialogTitle>
            <DialogDescription className="text-base font-medium text-foreground line-clamp-2">
              {itemTitle}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              {locale === "ar" ? "هذا المحتوى يتطلب اشتراكاً للوصول إليه" : locale === "fr" ? "Ce contenu nécessite un abonnement pour y accéder" : "This content requires a subscription to access"}
            </p>
            <Button className="w-full" size="lg" onClick={handleSubscribe}>
              <Crown className="h-4 w-4 me-2" />
              {t("common.subscribeForFull")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-500" />
            {t("common.premiumContent")}
          </DialogTitle>
          <DialogDescription className="text-base font-medium text-foreground line-clamp-2">
            {itemTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{t("common.priceLabel")}</p>
            <p className="text-3xl font-bold text-teal-600 dark:text-teal-400">
              {displayPrice.toLocaleString()}{" "}
              <span className="text-base font-normal">{t("common.currency")}</span>
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <Button className="w-full" size="lg" onClick={handleBuyNow}>
            <ShoppingBag className="h-4 w-4 me-2" />
            {t("common.buyItemFor")} {displayPrice.toLocaleString()} {t("common.currency")}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {t("common.or")}
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={handleSubscribe}
          >
            <Crown className="h-4 w-4 me-2" />
            {t("common.subscribeForFull")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
