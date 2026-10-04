#!/usr/bin/env python3
"""Rebuild fictional enterprise fixtures; Python 3.10+, standard library only."""
import csv
import hashlib
import json
import random
from collections import Counter
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SEED = 260803
AS_OF = "2026-08-31T23:59:59-04:00"
START = date(2026, 8, 1)
D = Decimal

SCHEMAS = {
    "01_cash_monkey_orders_aug2026.csv": "order_id,order_date,sku,title,category,store_id,buyer_id,quantity,item_revenue,shipping_revenue,refund_amount,payment_fee,payout_amount",
    "02_upright_paid_order_items_aug2026.csv": "paid_order_id,paid_at,item_id,store_id,channel,buyer_id,item_title,category,gross_sales,shipping_collected,sales_tax,marketplace_fee,refund_amount,net_sales",
    "03_jewelry_report_aug2026.csv": "jewelry_batch_id,item_id,sale_date,supplier,store_id,metal_type,category,gross_sales,appraisal_fee,commission_fee,net_sales,supplier_confirmed",
    "04_shipping_osm_pb_easypost_aug2026.csv": "provider,account,transaction_id,ship_date,order_id,store_id,service,postage_amount,adjustment_amount,gl_account,department",
    "05_fedex_charges_refunds_aug2026.csv": "invoice_id,transaction_id,ship_date,order_id,charge_type,vendor_id,gl_account,department,charge_amount,refund_amount,net_amount,bc_deposit_id",
    "06_shopgoodwill_periodic_reports_aug2026.csv": "report_name,period,sale_date,order_id,item_id,store_id,buyer_id,category,gross_sales,buyer_premium,shipping_collected,tax_collected,refund_amount,net_sales,report_type",
    "07_goodwill_books_payment_statement_aug2026.csv": "statement_id,statement_month,payment_date,order_id,isbn,store_id,buyer_id,gross_sales,marketplace_fee,shipping_credit,refund_amount,net_payout",
    "08_ebay_listing_sales_aug2026.csv": "transaction_id,sale_date,listing_id,item_id,store_id,buyer_id,category,quantity,sale_amount,shipping_paid,tax_collected,ebay_fee,refund_amount,payout_amount,relisted",
    "09_amazon_payments_summary_aug2026.csv": "settlement_id,posted_date,amazon_order_id,sku,store_id,buyer_region,product_sales,shipping_credits,promo_rebates,selling_fees,fba_or_shipping_fees,refunds,net_proceeds",
    "10_stores.csv": "store_id,store_name,district,cost_center,timezone,currency,synthetic",
    "11_listing_events_aug2026.csv": "platform,listing_id,item_id,store_id,listed_at,source_row_id",
    "12_inventory_snapshots_aug2026.csv": "snapshot_at,item_id,store_id,workflow_state,source_row_id",
    "13_item_catalog.csv": "item_id,platform,store_id,title,category,condition,received_at,listed_at,sold_at,canceled_at,listing_id,synthetic",
    "14_quality_exceptions.csv": "source_file,source_row_id,record_id,field,issue,expected_handling,synthetic",
    "15_order_lifecycle.csv": "source_file,source_row_id,order_id,ordered_at,ship_date,fulfillment_status,refund_recorded_at,currency,synthetic",
}

COUNTS = {"CM": 500, "UP": 650, "JWL": 240, "SGW": 1800,
          "GWB": 450, "EB": 900, "AMZ": 650}
FILES = {"CM": list(SCHEMAS)[0], "UP": list(SCHEMAS)[1],
         "JWL": list(SCHEMAS)[2], "SGW": list(SCHEMAS)[5],
         "GWB": list(SCHEMAS)[6], "EB": list(SCHEMAS)[7],
         "AMZ": list(SCHEMAS)[8]}
CATEGORIES = {
    "Electronics": (65, ["Sony stereo receiver — tested", "Canon EF zoom lens, 75–300mm", "Nintendo DS console with charger", "Bose portable speaker, cosmetic wear", "Vintage cassette deck, powers on"]),
    "Collectibles": (42, ["Vintage Pyrex mixing bowl set", "Model train locomotive, boxed", "Signed studio pottery vase", "Estate postcard collection, 80 pieces", "Die-cast vehicle lot, assorted"]),
    "Apparel": (23, ["Patagonia fleece jacket, size M", "Levi's denim jacket, size L", "Wool cardigan, size S", "Vintage concert T-shirt, size XL"]),
    "Home": (31, ["Stoneware dinner service, 12 pieces", "Brass table lamp, tested", "Handwoven wool rug, 3 × 5 ft", "KitchenAid hand mixer with beaters"]),
    "Tools": (48, ["DeWalt cordless drill, tool only", "Craftsman socket set, 32 pieces", "Vintage Stanley hand plane", "Digital multimeter, tested"]),
    "Sporting Goods": (47, ["Golf iron set, right handed", "Fishing reel with spare spool", "Hiking backpack, 40L", "Tennis racquet pair with covers"]),
    "Jewelry": (110, ["Sterling silver necklace, 18 inch", "Vintage costume jewelry lot", "Gold-tone wristwatch, untested", "Sterling ring, size 7"]),
    "Books": (17, ["Hardcover regional cookbook", "Illustrated field guide, revised edition", "Engineering reference manual", "Mystery paperback lot, 6 books", "Art history volume, dust jacket"]),
    "Accessories": (29, ["Leather tote bag, brown", "Silk scarf, floral print", "Travel duffel, navy", "Vintage belt with brass buckle"]),
}


def money(value):
    return D(str(value)).quantize(D("0.01"), rounding=ROUND_HALF_UP)


def dollars(value):
    return f"{money(value):.2f}"


def timestamp(day, hour=12, minute=0):
    return f"{day.isoformat()}T{hour:02d}:{minute:02d}:00-04:00"


def write_csv(name, rows):
    path = ROOT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    schema_name = name if name in SCHEMAS else FILES["SGW" if "shopgoodwill" in name else "EB"]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=SCHEMAS[schema_name].split(","))
        writer.writeheader()
        writer.writerows(rows)


def generate():
    rng = random.Random(SEED)
    tables = {name: [] for name in SCHEMAS}
    stores = [f"GW-{i:03d}" for i in range(1, 25)]
    # Uneven sourcing; stable store profiles are not actual store performance.
    weights = [1.9, 1.3, .65, 2.3, .9, 1.2, .8, 1.7, 1.4, .7, 1.1, 2.0,
               .6, .85, 1.1, 1.5, 1.8, 1.2, .55, 1.4, .9, 1.0, .7, 1.6]
    for i, store in enumerate(stores):
        tables["10_stores.csv"].append(dict(
            store_id=store, store_name=f"Fictional Donation Store {i+1:02d}",
            district=f"Demo District {i//8+1}", cost_center=f"DEMO-{180+i:03d}",
            timezone="America/Indiana/Indianapolis", currency="USD", synthetic="true"))

    days = [START + timedelta(days=i) for i in range(31)]
    day_weights = [(1.25 if d.weekday() >= 5 else 1.0) *
                   (1.15 if d.day >= 24 else 1.0) for d in days]
    orders, catalog, exceptions = [], tables["13_item_catalog.csv"], tables["14_quality_exceptions.csv"]
    listing_rows = tables["11_listing_events_aug2026.csv"]
    platform_names = {"SGW": "ShopGoodwill", "EB": "eBay"}

    def add_catalog(prefix, item, store, category, title, sold=None, listing=None):
        end = sold or date(2026, 8, 31)
        if sold:
            listed = sold - timedelta(days=rng.randint(2, 38))
            received = listed - timedelta(days=rng.randint(1, 14))
        else:
            received = date(2026, 7, 10) + timedelta(days=rng.randint(0, 52))
            delay = rng.randint(2, 24)
            listed = received + timedelta(days=delay)
            if listed > end or rng.random() < .45:
                listed = None
        listing = listing if listed else ""
        entry = dict(item_id=item, platform=platform_names[prefix], store_id=store,
                     title=title, category=category,
                     condition=rng.choice(["Used - Good", "Used - Very Good", "Used - Acceptable", "For parts / repair"]),
                     received_at=timestamp(received, 9),
                     listed_at=timestamp(listed, 11) if listed else "",
                     sold_at=timestamp(sold, 17) if sold else "",
                     canceled_at="",
                     listing_id=listing, synthetic="true")
        catalog.append(entry)
        if listed:
            listing_rows.append(dict(platform=platform_names[prefix], listing_id=listing,
                                     item_id=item, store_id=store, listed_at=entry["listed_at"],
                                     source_row_id=f"LIST-{len(listing_rows)+1:06d}"))
        return entry

    for prefix, count in COUNTS.items():
        filename = FILES[prefix]
        for i in range(1, count + 1):
            day = rng.choices(days, weights=day_weights)[0]
            store = rng.choices(stores, weights=weights)[0]
            category = "Books" if prefix in ("CM", "GWB", "AMZ") else rng.choices(
                list(CATEGORIES), weights=[24, 18, 13, 12, 8, 7, 6, 8, 4])[0]
            if prefix == "JWL":
                category = "Jewelry"
            median, titles = CATEGORIES[category]
            title = rng.choice(titles)
            gross = money(max(3.49, min(1250, rng.lognormvariate(0, .65) * median)))
            # Rare high-value donations, not uniformly random six-figure sales.
            if prefix in ("SGW", "EB") and rng.random() < .008:
                gross = money(rng.uniform(450, 1450))
            shipping = money(rng.uniform(3.99, 7.49) if category == "Books" else rng.uniform(5.25, 18.95))
            if rng.random() < .08:
                shipping = D("0.00")  # pickup/free-shipping order; not necessarily zero expense
            refund = D("0.00")
            if rng.random() < .055:
                refund = gross if rng.random() < .28 else money(gross * D(str(rng.uniform(.1, .55))))
            tax = money((gross + shipping) * D(rng.choice(["0", ".06", ".07", ".08"])))
            fee = money((gross + shipping) * D(".115") + D(".30"))
            buyer = f"BUY-{prefix}-{rng.randint(1, max(30, int(count*.62))):05d}"
            order = f"{prefix}-2608-{i:06d}"
            item = f"{prefix}-ITM-{i:06d}"
            listing = f"{prefix}-LST-{i:06d}"
            row = {}
            if prefix == "CM":
                fee = money((gross + shipping) * D(".047") + D(".30"))
                row = dict(order_id=order, order_date=str(day), sku=f"BOOK-{i:06d}",
                           title=title, category=category, store_id=store, buyer_id=buyer,
                           quantity=rng.choices([1, 2, 3, 6], [80, 10, 7, 3])[0],
                           item_revenue=dollars(gross), shipping_revenue=dollars(shipping),
                           refund_amount=dollars(refund), payment_fee=dollars(fee),
                           payout_amount=dollars(gross+shipping-refund-fee))
            elif prefix == "UP":
                row = dict(paid_order_id=order, paid_at=timestamp(day, rng.randint(8, 20), rng.randint(0, 59)),
                           item_id=item, store_id=store, channel="Upright", buyer_id=buyer,
                           item_title=title, category=category, gross_sales=dollars(gross),
                           shipping_collected=dollars(shipping), sales_tax=dollars(tax),
                           marketplace_fee=dollars(fee), refund_amount=dollars(refund),
                           net_sales=dollars(gross+shipping-refund))
                if i % 79 == 0:
                    row["buyer_id"] = ""
            elif prefix == "JWL":
                metal = rng.choices(["Gold", "Silver", "Costume"], [15, 45, 40])[0]
                gross = money(rng.lognormvariate(0, .55) * {"Gold": 310, "Silver": 78, "Costume": 26}[metal])
                appraisal = D({"Gold": "12", "Silver": "8", "Costume": "0"}[metal])
                commission = money(gross * D(".075"))
                row = dict(jewelry_batch_id=f"JWL-2608-{(day.day-1)//7+1:02d}",
                           item_id=item, sale_date=str(day), supplier="Demo Jewelry Partner",
                           store_id=store, metal_type=metal,
                           category=rng.choice(["Rings", "Necklaces", "Bracelets", "Earrings", "Watches", "Brooches"]),
                           gross_sales=dollars(gross), appraisal_fee=dollars(appraisal),
                           commission_fee=dollars(commission), net_sales=dollars(gross-appraisal-commission),
                           supplier_confirmed="true")
                if i % 41 == 0:
                    row.update(supplier="", supplier_confirmed="false")
            elif prefix == "SGW":
                # Premium is inherited mock contract only, NOT a verified marketplace policy.
                premium = money(gross * D(".10"))
                row = dict(report_name="SYNTHETIC ShopGoodwill Periodic August 2026", period="2026-08",
                           sale_date=str(day), order_id=order, item_id=item, store_id=store,
                           buyer_id=buyer, category=category, gross_sales=dollars(gross),
                           buyer_premium=dollars(premium), shipping_collected=dollars(shipping),
                           tax_collected=dollars(tax), refund_amount=dollars(refund),
                           net_sales=dollars(gross+premium+shipping-refund), report_type="periodic")
                if i % 211 == 0:
                    row["store_id"] = ""
            elif prefix == "GWB":
                fee = money(gross * D(".15"))
                isbn_base = f"978000{i:06d}"
                checksum = (10 - sum(int(c) * (1 if n % 2 == 0 else 3)
                                     for n, c in enumerate(isbn_base)) % 10) % 10
                row = dict(statement_id="GWB-STMT-2608", statement_month="2026-08",
                           payment_date="2026-09-03", order_id=order, isbn=isbn_base+str(checksum),
                           store_id=store, buyer_id=buyer, gross_sales=dollars(gross),
                           marketplace_fee=dollars(fee), shipping_credit=dollars(shipping),
                           refund_amount=dollars(refund), net_payout=dollars(gross+shipping-refund-fee))
            elif prefix == "EB":
                row = dict(transaction_id=order, sale_date=str(day), listing_id=listing,
                           item_id=item, store_id=store, buyer_id=buyer, category=category,
                           quantity=rng.choices([1, 2, 3], [94, 4, 2])[0],
                           sale_amount=dollars(gross), shipping_paid=dollars(shipping),
                           tax_collected=dollars(tax), ebay_fee=dollars(fee),
                           refund_amount=dollars(refund), payout_amount=dollars(gross+shipping-refund-fee),
                           relisted="true" if rng.random() < .09 else "false")
            elif prefix == "AMZ":
                promo = money(gross * D(".05")) if rng.random() < .08 else D("0")
                fee = money(gross * D(".15"))
                cost = money(rng.uniform(3.8, 9.5))
                row = dict(settlement_id=f"AMZ-SET-2608-{(day.day-1)//14+1:02d}",
                           posted_date=str(day), amazon_order_id=order, sku=f"AMZ-SKU-{i:06d}",
                           store_id=store, buyer_region=rng.choices(["IN", "MI", "IL", "OH", "WI", "CA", "NY", "TX"], [28, 24, 18, 10, 5, 6, 4, 5])[0],
                           product_sales=dollars(gross), shipping_credits=dollars(shipping),
                           promo_rebates=dollars(promo), selling_fees=dollars(fee),
                           fba_or_shipping_fees=dollars(cost), refunds=dollars(refund),
                           net_proceeds=dollars(gross+shipping-promo-fee-cost-refund))
            tables[filename].append(row)
            # Book statement does not expose order date; internal date only models fulfillment.
            if prefix != "JWL":
                orders.append(dict(order_id=order, store_id=row["store_id"], day=day, category=category,
                                   fully_refunded=refund == gross, refund=refund, shipping=shipping,
                                   source_file=filename))
            if prefix in platform_names:
                # Missing store is propagated: do not recover attribution from hidden generator state.
                add_catalog(prefix, item, row["store_id"], category, title, day, listing)

    # Deterministic source row numbering after chronological sorting.
    date_keys = {"CM": "order_date", "UP": "paid_at", "JWL": "sale_date",
                 "SGW": "sale_date", "GWB": "payment_date", "EB": "sale_date", "AMZ": "posted_date"}
    id_keys = {"CM": "order_id", "UP": "paid_order_id", "JWL": "item_id",
               "SGW": "order_id", "GWB": "order_id", "EB": "transaction_id", "AMZ": "amazon_order_id"}
    for prefix, filename in FILES.items():
        tables[filename].sort(key=lambda row: (row[date_keys[prefix]], row[id_keys[prefix]]))
        for n, row in enumerate(tables[filename], 1):
            for field, issue in [("store_id", "missing_store"), ("buyer_id", "missing_buyer"),
                                 ("supplier", "unconfirmed_supplier")]:
                if field in row and not row[field]:
                    exceptions.append(dict(source_file=filename, source_row_id=str(n),
                                           record_id=row[id_keys[prefix]], field=field, issue=issue,
                                           expected_handling="flag; never infer missing value", synthetic="true"))

    # Fulfillment lines are expenses, not extra marketplace sales. One shipment/order.
    for order in sorted(orders, key=lambda o: (o["day"], o["order_id"])):
        order["ship_date"] = ""
        if order["fully_refunded"]:
            order["fulfillment_status"] = "canceled_before_fulfillment"
            continue
        if order["shipping"] == 0 and rng.random() < .75:
            order["fulfillment_status"] = "local_pickup"
            continue
        ship = order["day"] + timedelta(days=rng.choices([1, 2, 3, 4, 5], [46, 30, 15, 7, 2])[0])
        while ship.weekday() >= 5:
            ship += timedelta(days=1)
        if ship.month != 8:
            order["fulfillment_status"] = "pending_fulfillment"
            continue  # August exports intentionally do not include September fulfillment
        order["ship_date"] = str(ship)
        order["fulfillment_status"] = "shipped"
        if rng.random() < .19:
            table = tables["05_fedex_charges_refunds_aug2026.csv"]
            n = len(table) + 1
            charge = money(rng.uniform(12.5, 37.5))
            refund = money(charge * D(".2")) if rng.random() < .07 else D("0")
            table.append(dict(invoice_id=f"DEMO-FDX-2608-{(ship.day-1)//7+1:02d}",
                              transaction_id=f"FDX-TX-{n:06d}", ship_date=str(ship),
                              order_id=order["order_id"], charge_type="Shipping",
                              vendor_id="DEMO-V00122", gl_account="40356", department="180",
                              charge_amount=dollars(charge), refund_amount=dollars(refund),
                              net_amount=dollars(charge-refund), bc_deposit_id=""))
        else:
            table = tables["04_shipping_osm_pb_easypost_aug2026.csv"]
            n = len(table) + 1
            provider = rng.choices(["OSM", "Pitney Bowes", "EasyPost"], [50, 30, 20])[0]
            amount = money(rng.uniform(3.5, 15.25))
            adjust = money(rng.uniform(-2, 3.5)) if rng.random() < .06 else D("0")
            table.append(dict(provider=provider, account="DEMO-0101",
                              transaction_id=f"SHIP-2608-{n:06d}", ship_date=str(ship),
                              order_id=order["order_id"], store_id=order["store_id"],
                              service={"OSM": "Parcel Select", "Pitney Bowes": "USPS Ground Advantage",
                                       "EasyPost": rng.choice(["USPS Priority", "USPS Ground Advantage"])}[provider],
                              postage_amount=dollars(amount), adjustment_amount=dollars(adjust),
                              gl_account="10009", department="180"))

    row_lookup = {}
    catalog_lookup = {entry["item_id"]: entry for entry in catalog}
    for prefix, filename in FILES.items():
        if prefix != "JWL":
            row_lookup.update({r[id_keys[prefix]]: str(n)
                               for n, r in enumerate(tables[filename], 1)})
    for order in sorted(orders, key=lambda o: o["order_id"]):
        refund_date = ""
        if order["refund"]:
            earliest = date.fromisoformat(order["ship_date"]) if order["ship_date"] else order["day"]
            refund_date = timestamp(earliest + timedelta(days=rng.randint(0, min(10, 31-earliest.day))), 21)
        if order["fully_refunded"]:
            item_id = order["order_id"].replace("-2608-", "-ITM-")
            if item_id in catalog_lookup:
                catalog_lookup[item_id]["canceled_at"] = refund_date
        tables["15_order_lifecycle.csv"].append(dict(
            source_file=order["source_file"], source_row_id=row_lookup[order["order_id"]],
            order_id=order["order_id"], ordered_at=timestamp(order["day"], 8),
            ship_date=order["ship_date"], fulfillment_status=order["fulfillment_status"],
            refund_recorded_at=refund_date, currency="USD", synthetic="true"))

    # Full snapshots of the declared two-platform inventory universe, not sales-derived backlog.
    for i in range(1, 1201):
        prefix = rng.choices(["SGW", "EB"], [70, 30])[0]
        category = rng.choice(list(CATEGORIES))
        item = f"{prefix}-UNSOLD-{i:06d}"
        add_catalog(prefix, item, rng.choices(stores, weights=weights)[0], category,
                    rng.choice(CATEGORIES[category][1]), listing=f"{prefix}-OPEN-{i:06d}")
    snapshots = tables["12_inventory_snapshots_aug2026.csv"]
    for day in [date(2026, 8, 1), date(2026, 8, 15), date(2026, 8, 31)]:
        cutoff = timestamp(day, 23, 59).replace(":00-04:00", ":59-04:00")
        for entry in sorted(catalog, key=lambda x: x["item_id"]):
            canceled = bool(entry["canceled_at"] and entry["canceled_at"] <= cutoff)
            if entry["received_at"] > cutoff or (entry["sold_at"] and entry["sold_at"] <= cutoff and not canceled):
                continue
            age = (day - date.fromisoformat(entry["received_at"][:10])).days
            state = "listed" if entry["listed_at"] and entry["listed_at"] <= cutoff else (
                "received" if age < 2 else "awaiting_inspection" if age < 5 else
                "awaiting_photography" if age < 10 else "ready_to_list")
            if canceled:
                since_cancel = (day - date.fromisoformat(entry["canceled_at"][:10])).days
                state = "awaiting_inspection" if since_cancel < 3 else "ready_to_list"
            snapshots.append(dict(snapshot_at=cutoff, item_id=entry["item_id"],
                                  store_id=entry["store_id"], workflow_state=state,
                                  source_row_id=f"INV-{len(snapshots)+1:06d}"))
    listing_rows.sort(key=lambda r: (r["listed_at"], r["listing_id"]))
    catalog.sort(key=lambda r: r["item_id"])
    # Rename listing file explicitly: sale-cohort listings include July history.
    for name, rows in tables.items():
        write_csv(name, rows)

    # Re-upload and rejection demos are opt-in, never mixed into the base totals.
    write_csv("test-fixtures/ebay_duplicate_replay.csv", tables[FILES["EB"]][:25])
    bad = []
    for field, value in [("sale_date", "2026-08-99"), ("sale_amount", "-18.00"),
                         ("transaction_id", ""), ("sale_amount", "not-a-number"),
                         ("refund_amount", "99999.00")]:
        row = dict(tables[FILES["EB"]][0])
        row["transaction_id"] = f"INVALID-EB-{len(bad)+1:02d}"
        row[field] = value
        bad.append(row)
    write_csv("test-fixtures/ebay_invalid_rows.csv", bad)
    next_day = {}
    for prefix, count in [("SGW", 60), ("EB", 30)]:
        name = f"incremental/{'shopgoodwill' if prefix == 'SGW' else 'ebay'}_sep01_2026.csv"
        rows = []
        for i, original in enumerate(tables[FILES[prefix]][:count], 1):
            row = dict(original)
            row[id_keys[prefix]] = f"{prefix}-2609-{i:06d}"
            row["item_id"] = f"{prefix}-SEP-ITM-{i:06d}"
            row["sale_date"] = "2026-09-01"
            if prefix == "SGW":
                row.update(report_name="SYNTHETIC ShopGoodwill Daily September 1 2026",
                           period="2026-09", report_type="daily")
            else:
                row["listing_id"] = f"EB-SEP-LST-{i:06d}"
            rows.append(row)
        write_csv(name, rows)
        next_day[name] = count

    def total(rows, field):
        return dollars(sum((D(r[field]) for r in rows), D("0")))

    financial_fields = {
        "CM": ["item_revenue", "shipping_revenue", "refund_amount", "payment_fee", "payout_amount"],
        "UP": ["gross_sales", "shipping_collected", "refund_amount", "marketplace_fee", "net_sales"],
        "JWL": ["gross_sales", "appraisal_fee", "commission_fee", "net_sales"],
        "SGW": ["gross_sales", "buyer_premium", "shipping_collected", "refund_amount", "net_sales"],
        "GWB": ["gross_sales", "marketplace_fee", "shipping_credit", "refund_amount", "net_payout"],
        "EB": ["sale_amount", "shipping_paid", "ebay_fee", "refund_amount", "payout_amount"],
        "AMZ": ["product_sales", "shipping_credits", "promo_rebates", "selling_fees", "fba_or_shipping_fees", "refunds", "net_proceeds"],
    }
    controls = {FILES[p]: {field: total(tables[FILES[p]], field) for field in fields}
                for p, fields in financial_fields.items()}
    controls["04_shipping_osm_pb_easypost_aug2026.csv"] = {
        f: total(tables["04_shipping_osm_pb_easypost_aug2026.csv"], f)
        for f in ["postage_amount", "adjustment_amount"]}
    controls["05_fedex_charges_refunds_aug2026.csv"] = {
        f: total(tables["05_fedex_charges_refunds_aug2026.csv"], f)
        for f in ["charge_amount", "refund_amount", "net_amount"]}
    daily = []
    for prefix, gross_field in [("SGW", "gross_sales"), ("EB", "sale_amount")]:
        rows = tables[FILES[prefix]]
        for day in days:
            subset = [r for r in rows if r["sale_date"] == str(day)]
            net = sum((D(r[gross_field])-D(r["refund_amount"]) for r in subset), D("0"))
            daily.append(dict(platform=platform_names[prefix], day=str(day), rows=len(subset),
                              gross_item_sales=total(subset, gross_field),
                              refunds=total(subset, "refund_amount"),
                              net_item_revenue=dollars(net),
                              distinct_platform_buyers=len({r["buyer_id"] for r in subset if r["buyer_id"]}),
                              missing_store_rows=sum(not r["store_id"] for r in subset)))
    backlog = {}
    for cutoff in sorted({r["snapshot_at"] for r in snapshots}):
        subset = [r for r in snapshots if r["snapshot_at"] == cutoff]
        backlog[cutoff] = dict(total_inventory=len(subset),
                              workflow_states=dict(sorted(Counter(r["workflow_state"] for r in subset).items())),
                              unlisted_backlog=sum(r["workflow_state"] != "listed" for r in subset),
                              missing_store_rows=sum(not r["store_id"] for r in subset))
    manifest = dict(synthetic=True, seed=SEED, currency="USD", as_of=AS_OF,
                    revenue_convention="gross item sales minus item refunds; exclude shipping, tax, buyer premium, fees",
                    source_row_convention="1-based data row, excluding CSV header; file name + row number is provenance",
                    files={name: dict(rows=len(rows), sha256=hashlib.sha256((ROOT/name).read_bytes()).hexdigest())
                           for name, rows in tables.items()},
                    control_totals=controls, daily_core_metrics=daily, inventory_controls=backlog,
                    incremental_files=next_day, expected_exceptions=len(exceptions),
                    excluded_from_august=["incremental/", "test-fixtures/"])
    (ROOT/"manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True)+"\n", encoding="utf-8")
    print(json.dumps({name: len(rows) for name, rows in tables.items()}, indent=2))
    return tables


if __name__ == "__main__":
    generate()