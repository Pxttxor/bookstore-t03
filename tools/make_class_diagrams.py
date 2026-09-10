# -*- coding: utf-8 -*-
"""
Script to generate Class Diagram in Relational Databases for Bookstore T03:
- Tab 1: Combined Class Diagram (Relational Database Schema) - Delivery & Review Subsystems
- Tab 2: Delivery Subsystem Class Diagram (Relational Database Schema)
- Tab 3: Review Subsystem Class Diagram (Relational Database Schema)
Saves to 'classdiagram1.drawio', 'classdiagram1', 'classdiagram.drawio', 'classdiagram'
"""
import html

def make_entity(entity_id, title, columns, x, y, w, h):
    col_text = '&#xa;'.join([html.escape(c) for c in columns])
    # UML / Relational Database entity box with header and divider (matching example screenshot)
    xml = f'''        <mxCell id="{entity_id}" value="" style="swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=26;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;html=1;strokeColor=#000000;strokeWidth=1.5;fillColor=#ffffff;rounded=1;arcSize=8;fontFamily=TH SarabunPSK, Tahoma, sans-serif;" vertex="1" parent="1">
          <mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry" />
        </mxCell>
        <mxCell id="{entity_id}_header" value="&lt;b&gt;{html.escape(title)}&lt;/b&gt;" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontStyle=1;fontSize=12;fontFamily=TH SarabunPSK, Tahoma, sans-serif;" vertex="1" parent="{entity_id}">
          <mxGeometry width="{w}" height="26" as="geometry" />
        </mxCell>
        <mxCell id="{entity_id}_body" value="{col_text}" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=top;spacingLeft=8;spacingTop=6;spacingRight=8;spacingBottom=6;overflow=hidden;rounded=0;html=1;fontSize=11;fontFamily=TH SarabunPSK, Tahoma, monospace;lineHeight=1.4;" vertex="1" parent="{entity_id}">
          <mxGeometry y="26" width="{w}" height="{h - 26}" as="geometry" />
        </mxCell>'''
    return xml

def make_relation(rel_id, source_id, target_id, label='', is_composition=False, start_arrow='none', end_arrow='none', exit_x=None, exit_y=None, entry_x=None, entry_y=None, points=None):
    style = 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1.2;fontSize=10;fontFamily=TH SarabunPSK, Tahoma, sans-serif;'
    
    if is_composition:
        style += 'startArrow=diamond;startFill=1;startSize=12;endArrow=none;'
    else:
        if start_arrow != 'none':
            style += f'startArrow={start_arrow};'
        else:
            style += 'startArrow=none;'
        if end_arrow != 'none':
            style += f'endArrow={end_arrow};'
        else:
            style += 'endArrow=none;'
            
    if exit_x is not None and exit_y is not None:
        style += f'exitX={exit_x};exitY={exit_y};exitDx=0;exitDy=0;'
    if entry_x is not None and entry_y is not None:
        style += f'entryX={entry_x};entryY={entry_y};entryDx=0;entryDy=0;'
        
    lbl_escaped = html.escape(label).replace('\n', '&#xa;')
    points_xml = ''
    if points:
        pts = ''.join([f'<mxPoint x="{pt[0]}" y="{pt[1]}" />' for pt in points])
        points_xml = f'<Array as="points">{pts}</Array>'
        
    return f'''        <mxCell id="{rel_id}" value="{lbl_escaped}" style="{style}" edge="1" parent="1" source="{source_id}" target="{target_id}">
          <mxGeometry relative="1" as="geometry">{points_xml}</mxGeometry>
        </mxCell>'''

def build_tab(diagram_id, diagram_name, title_text, entities_xml, relations_xml, canvas_w=1450, canvas_h=1020):
    out = []
    out.append(f'  <diagram id="{diagram_id}" name="{html.escape(diagram_name)}">')
    out.append(f'    <mxGraphModel dx="1200" dy="950" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{canvas_w}" pageHeight="{canvas_h}" math="0" shadow="0">')
    out.append('      <root>')
    out.append('        <mxCell id="0" />')
    out.append('        <mxCell id="1" parent="0" />')
    
    # Outer frame
    out.append(f'        <mxCell id="outer_frame_{diagram_id}" value="" style="shape=rect;html=1;whiteSpace=wrap;fillColor=none;strokeColor=#000000;strokeWidth=1.5;" vertex="1" parent="1">')
    out.append(f'          <mxGeometry x="40" y="30" width="{canvas_w - 80}" height="{canvas_h - 60}" as="geometry" />')
    out.append('        </mxCell>')
    
    # Top Tab Header (Matching folder tab style in screenshot)
    out.append(f'        <mxCell id="tab_header_{diagram_id}" value="&lt;b&gt;{html.escape(title_text)}&lt;/b&gt;" style="shape=folder;tabWidth=620;tabHeight=26;tabPosition=left;html=1;whiteSpace=wrap;fillColor=none;strokeColor=#000000;strokeWidth=1.5;fontSize=12;fontFamily=TH SarabunPSK, Tahoma, sans-serif;spacingLeft=10;verticalAlign=middle;align=left;" vertex="1" parent="1">')
    out.append('          <mxGeometry x="40" y="30" width="640" height="26" as="geometry" />')
    out.append('        </mxCell>')
    
    for e in entities_xml:
        out.append(e)
    for r in relations_xml:
        out.append(r)
        
    out.append('      </root>')
    out.append('    </mxGraphModel>')
    out.append('  </diagram>')
    return '\n'.join(out)

# ==============================================================================
# TAB 1: COMBINED CLASS DIAGRAM (DELIVERY & REVIEW CONNECTED SCHEMA)
# ==============================================================================
comb_entities = [
    # --- Bridge 1: Customer (Top Center-Left) ---
    make_entity('c_cust', 'Customer', [
        'customerId : INT [PK]',
        'personId : INT [FK]',
        'name : VARCHAR(100)',
        'email : VARCHAR(100)',
        'phone : VARCHAR(20)',
        'defaultAddress : VARCHAR(255)',
        'registeredDate : DATE'
    ], 330, 80, 200, 160),

    # --- Bridge 2: Book (Top Center) ---
    make_entity('c_book', 'Book', [
        'bookId : INT [PK]',
        'categoryId : INT [FK]',
        'title : VARCHAR(150)',
        'isbn : VARCHAR(20)',
        'author : VARCHAR(200)',
        'publisher : VARCHAR(200) [Nullable]',
        'price : DECIMAL(10,2)',
        'stockQty : INT',
        'status : VARCHAR(20)'
    ], 600, 80, 210, 185),

    # --- Bridge 3: Orders (Center) ---
    make_entity('c_order', 'Orders', [
        'orderId : INT [PK]',
        'customerId : INT [FK]',
        'channel : VARCHAR(20)',
        'orderDate : DATETIME',
        'shippingAddress : VARCHAR(255)',
        'status : VARCHAR(30)',
        'subtotal : DECIMAL(10,2)',
        'discountAmount : DECIMAL(10,2)',
        'netAmount : DECIMAL(10,2)',
        'promotionId : INT [FK, Nullable]',
        'approvedBy : INT [FK, Nullable]',
        'customerName : VARCHAR(200) [Nullable]',
        'customerPhone : VARCHAR(50) [Nullable]',
        'discountCode : VARCHAR(50) [Nullable]',
        'slipFileName : VARCHAR(200) [Nullable]',
        'cancelReason : TEXT [Nullable]',
        'replacementBookId : INT [FK, Nullable]',
        'outOfStockNote : TEXT [Nullable]',
        'restockEstimate : VARCHAR(100) [Nullable]',
        'restockDate : DATE [Nullable]',
        'customerChoice : VARCHAR(50) [Nullable]',
        'refundStatus : VARCHAR(30) [Nullable]'
    ], 440, 310, 250, 420),

    # --- Review Subsystem: Review (Left of Orders) ---
    make_entity('c_rev', 'Review', [
        'reviewId : INT [PK]',
        'customerId : INT [FK]',
        'bookId : INT [FK]',
        'orderId : INT [FK, Nullable]',
        'rating : INT',
        'comment : TEXT',
        'status : VARCHAR(20)',
        'flagged : BOOLEAN',
        'createdDate : DATETIME'
    ], 70, 330, 220, 185),

    # --- Review Subsystem: ReviewReply (Far Left) ---
    make_entity('c_reply', 'ReviewReply', [
        'replyId : INT [PK]',
        'reviewId : INT [FK]',
        'replyText : TEXT',
        'repliedDate : DATETIME',
        'repliedBy : VARCHAR(200)'
    ], 70, 580, 200, 125),

    # --- Review Subsystem: ReviewReport (Bottom Left) ---
    make_entity('c_report', 'ReviewReport', [
        'reportId : INT [PK]',
        'reviewId : INT [FK, Unique]',
        'reason : VARCHAR(200)',
        'detail : TEXT [Nullable]',
        'reportedBy : VARCHAR(200)',
        'reportedDate : DATETIME',
        'status : VARCHAR(20)',
        'decidedBy : VARCHAR(200) [Nullable]',
        'decidedDate : DATETIME [Nullable]'
    ], 70, 750, 220, 185),

    # --- Staff: SalesStaff & StoreManager (Bottom Center) ---
    make_entity('c_sales', 'SalesStaff', [
        'staffId : INT [PK]',
        'personId : INT [FK]',
        'staffName : VARCHAR(100)',
        'role : VARCHAR(50)',
        'email : VARCHAR(100)',
        'phone : VARCHAR(20)'
    ], 340, 790, 190, 135),

    make_entity('c_manager', 'StoreManager', [
        'managerId : INT [PK]',
        'personId : INT [FK]',
        'managerName : VARCHAR(100)',
        'role : VARCHAR(50)',
        'email : VARCHAR(100)',
        'phone : VARCHAR(20)'
    ], 570, 790, 190, 135),

    # --- Delivery Subsystem: Shipment (Right of Orders) ---
    make_entity('c_ship', 'Shipment', [
        'shipmentId : INT [PK]',
        'orderId : INT [FK, Unique]',
        'carrierId : INT [FK]',
        'trackingNumber : VARCHAR(100)',
        'recipientName : VARCHAR(200)',
        'shippedDate : DATE',
        'status : VARCHAR(20)'
    ], 820, 330, 220, 160),

    # --- Delivery Subsystem: ShipmentTracking (Far Right) ---
    make_entity('c_track', 'ShipmentTracking', [
        'trackingId : INT [PK]',
        'shipmentId : INT [FK]',
        'status : VARCHAR(20)',
        'location : VARCHAR(200) [Nullable]',
        'updateDate : DATETIME',
        'note : TEXT [Nullable]'
    ], 1110, 330, 210, 145),

    # --- Delivery Subsystem: ShippingCompany (Top Right) ---
    make_entity('c_carrier', 'ShippingCompany', [
        'carrierId : INT [PK]',
        'name : VARCHAR(200)',
        'trackingUrlTemplate : VARCHAR(300)'
    ], 850, 90, 220, 105),

    # --- Delivery Subsystem: DeliverySummary (Bottom Right) ---
    make_entity('c_summary', 'DeliverySummary', [
        'summaryId : INT [PK]',
        'summaryDate : DATE',
        'totalParcels : INT',
        'totalByCarrier : TEXT [Nullable]',
        'generatedBy : VARCHAR(200)'
    ], 820, 570, 210, 125),

    # --- Staff: DeliveryStaff (Bottom Far Right) ---
    make_entity('c_delstaff', 'DeliveryStaff', [
        'staffId : INT [PK]',
        'personId : INT [FK]',
        'staffName : VARCHAR(100)',
        'role : VARCHAR(50)',
        'phone : VARCHAR(20)'
    ], 1110, 570, 180, 125),
]

comb_relations = [
    # Customer -> Orders (places 1..N)
    make_relation('cr_c_o', 'c_cust', 'c_order', 'places (1..N)', exit_x=0.5, exit_y=1, entry_x=0.2, entry_y=0),
    
    # Customer -> Review (writes 0..N)
    make_relation('cr_c_r', 'c_cust', 'c_rev', 'writes (0..N)', exit_x=0, exit_y=0.7, entry_x=0.5, entry_y=0, points=[(180, 192)]),
    
    # Book -> Review (about 0..N)
    make_relation('cr_b_r', 'c_book', 'c_rev', 'about (0..N)', exit_x=0, exit_y=0.5, entry_x=0.8, entry_y=0, points=[(246, 172)]),
    
    # Orders -> Review (verifies buy 0..1 - Verified Purchase Bridge)
    make_relation('cr_o_r', 'c_order', 'c_rev', 'verifies buy (0..1)', exit_x=0, exit_y=0.25, entry_x=1, entry_y=0.25),
    
    # Review -> ReviewReply (composition 0..N)
    make_relation('cr_r_rep', 'c_rev', 'c_reply', 'contains (0..N)', is_composition=True, exit_x=0.3, exit_y=1, entry_x=0.3, entry_y=0),
    
    # Review -> ReviewReport (escalates 0..1)
    make_relation('cr_r_rep2', 'c_rev', 'c_report', 'escalates (0..1)', exit_x=0.7, exit_y=1, entry_x=0.7, entry_y=0, points=[(224, 530), (224, 750)]),
    
    # SalesStaff -> ReviewReply (replies 0..N)
    make_relation('cr_s_rep', 'c_sales', 'c_reply', 'replies', exit_x=0, exit_y=0.4, entry_x=1, entry_y=0.6, points=[(290, 844), (290, 655)]),
    
    # SalesStaff -> ReviewReport (reports 0..N)
    make_relation('cr_s_rep2', 'c_sales', 'c_report', 'reports', exit_x=0, exit_y=0.7, entry_x=1, entry_y=0.5),
    
    # StoreManager -> ReviewReport (decides 0..N)
    make_relation('cr_m_rep', 'c_manager', 'c_report', 'decides / resolves', exit_x=0.2, exit_y=1, entry_x=0.8, entry_y=1, points=[(608, 960), (246, 960)]),
    
    # Orders -> Shipment (shipped via 1..1)
    make_relation('cr_o_s', 'c_order', 'c_ship', 'shipped via (1..1)', exit_x=1, exit_y=0.2, entry_x=0, entry_y=0.2),
    
    # ShippingCompany -> Shipment (carrier 1..N)
    make_relation('cr_c_s', 'c_carrier', 'c_ship', 'carrier (1..N)', exit_x=0.5, exit_y=1, entry_x=0.6, entry_y=0),
    
    # Shipment -> ShipmentTracking (composition 1..N)
    make_relation('cr_s_t', 'c_ship', 'c_track', 'tracks (1..N)', is_composition=True, exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
    
    # Shipment -> DeliverySummary (summarized in 0..N)
    make_relation('cr_s_sum', 'c_ship', 'c_summary', 'summarized in', exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
    
    # DeliveryStaff -> DeliverySummary (generates 0..N)
    make_relation('cr_ds_sum', 'c_delstaff', 'c_summary', 'generates', exit_x=0, exit_y=0.5, entry_x=1, entry_y=0.5),
    
    # StoreManager -> DeliverySummary (inspects)
    make_relation('cr_m_sum', 'c_manager', 'c_summary', 'inspects / approves', exit_x=1, exit_y=0.3, entry_x=0.2, entry_y=1, points=[(790, 830), (862, 830)]),
]

tab1_xml = build_tab(
    'tab_combined',
    'รวมสองระบบ (Delivery & Review)',
    'Class Diagram (Relational Database Schema) - ระบบจัดการการจัดส่งและระบบจัดการรีวิวลูกค้า (ฉบับบูรณาการ)',
    comb_entities,
    comb_relations,
    canvas_w=1400,
    canvas_h=1000
)

# ==============================================================================
# TAB 2: SEPARATE DELIVERY SUBSYSTEM CLASS DIAGRAM
# ==============================================================================
del_entities = [
    # Customer
    make_entity('d_cust', 'Customer', [
        'customerId : INT [PK]',
        'personId : INT [FK]',
        'name : VARCHAR(100)',
        'email : VARCHAR(100)',
        'phone : VARCHAR(20)',
        'defaultAddress : VARCHAR(255)'
    ], 80, 100, 200, 145),

    # Orders
    make_entity('d_order', 'Orders', [
        'orderId : INT [PK]',
        'customerId : INT [FK]',
        'channel : VARCHAR(20)',
        'orderDate : DATETIME',
        'shippingAddress : VARCHAR(255)',
        'status : VARCHAR(30)',
        'subtotal : DECIMAL(10,2)',
        'netAmount : DECIMAL(10,2)',
        'customerName : VARCHAR(200) [Nullable]',
        'customerPhone : VARCHAR(50) [Nullable]'
    ], 370, 100, 240, 230),

    # ShippingCompany
    make_entity('d_carrier', 'ShippingCompany', [
        'carrierId : INT [PK]',
        'name : VARCHAR(200)',
        'trackingUrlTemplate : VARCHAR(300)'
    ], 730, 100, 230, 105),

    # Shipment
    make_entity('d_ship', 'Shipment', [
        'shipmentId : INT [PK]',
        'orderId : INT [FK, Unique]',
        'carrierId : INT [FK]',
        'trackingNumber : VARCHAR(100)',
        'recipientName : VARCHAR(200)',
        'shippedDate : DATE',
        'status : VARCHAR(20)'
    ], 370, 410, 240, 165),

    # ShipmentTracking
    make_entity('d_track', 'ShipmentTracking', [
        'trackingId : INT [PK]',
        'shipmentId : INT [FK]',
        'status : VARCHAR(20)',
        'location : VARCHAR(200) [Nullable]',
        'updateDate : DATETIME',
        'note : TEXT [Nullable]'
    ], 730, 410, 230, 145),

    # DeliverySummary
    make_entity('d_summary', 'DeliverySummary', [
        'summaryId : INT [PK]',
        'summaryDate : DATE',
        'totalParcels : INT',
        'totalByCarrier : TEXT [Nullable]',
        'generatedBy : VARCHAR(200)'
    ], 370, 660, 240, 130),

    # DeliveryStaff
    make_entity('d_delstaff', 'DeliveryStaff', [
        'staffId : INT [PK]',
        'personId : INT [FK]',
        'staffName : VARCHAR(100)',
        'role : VARCHAR(50)',
        'phone : VARCHAR(20)'
    ], 730, 660, 210, 125),

    # StoreManager
    make_entity('d_manager', 'StoreManager', [
        'managerId : INT [PK]',
        'personId : INT [FK]',
        'managerName : VARCHAR(100)',
        'role : VARCHAR(50)',
        'phone : VARCHAR(20)'
    ], 80, 660, 210, 125),
]

del_relations = [
    make_relation('dr_c_o', 'd_cust', 'd_order', 'places (1..N)', exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
    make_relation('dr_o_s', 'd_order', 'd_ship', 'shipped via (1..1)', exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
    make_relation('dr_c_s', 'd_carrier', 'd_ship', 'carrier (1..N)', exit_x=0.3, exit_y=1, entry_x=0.8, entry_y=0, points=[(799, 340), (562, 340)]),
    make_relation('dr_s_t', 'd_ship', 'd_track', 'tracks (1..N)', is_composition=True, exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
    make_relation('dr_s_sum', 'd_ship', 'd_summary', 'summarized in', exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
    make_relation('dr_ds_s', 'd_delstaff', 'd_ship', 'delivers / updates', exit_x=0.2, exit_y=0, entry_x=0.9, entry_y=1, points=[(772, 595), (586, 595)]),
    make_relation('dr_ds_sum', 'd_delstaff', 'd_summary', 'generates (0..N)', exit_x=0, exit_y=0.5, entry_x=1, entry_y=0.5),
    make_relation('dr_m_sum', 'd_manager', 'd_summary', 'inspects / approves', exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
]

tab2_xml = build_tab(
    'tab_delivery',
    'ระบบจัดการการจัดส่ง (Delivery)',
    'Class Diagram (Relational Database Schema) - ระบบจัดการการจัดส่งพัสดุ (Delivery Subsystem)',
    del_entities,
    del_relations,
    canvas_w=1080,
    canvas_h=860
)

# ==============================================================================
# TAB 3: SEPARATE REVIEW SUBSYSTEM CLASS DIAGRAM
# ==============================================================================
rev_entities = [
    # Customer
    make_entity('r_cust', 'Customer', [
        'customerId : INT [PK]',
        'personId : INT [FK]',
        'name : VARCHAR(100)',
        'email : VARCHAR(100)',
        'phone : VARCHAR(20)'
    ], 80, 90, 200, 130),

    # Book
    make_entity('r_book', 'Book', [
        'bookId : INT [PK]',
        'categoryId : INT [FK]',
        'title : VARCHAR(150)',
        'isbn : VARCHAR(20)',
        'author : VARCHAR(200)',
        'price : DECIMAL(10,2)'
    ], 390, 90, 210, 145),

    # Orders (Verified purchase check)
    make_entity('r_order', 'Orders', [
        'orderId : INT [PK]',
        'customerId : INT [FK]',
        'orderDate : DATETIME',
        'status : VARCHAR(30)'
    ], 710, 90, 200, 115),

    # Review
    make_entity('r_rev', 'Review', [
        'reviewId : INT [PK]',
        'customerId : INT [FK]',
        'bookId : INT [FK]',
        'orderId : INT [FK, Nullable]',
        'rating : INT',
        'comment : TEXT',
        'status : VARCHAR(20)',
        'flagged : BOOLEAN',
        'createdDate : DATETIME'
    ], 380, 320, 230, 185),

    # ReviewReply
    make_entity('r_reply', 'ReviewReply', [
        'replyId : INT [PK]',
        'reviewId : INT [FK]',
        'replyText : TEXT',
        'repliedDate : DATETIME',
        'repliedBy : VARCHAR(200)'
    ], 80, 350, 210, 125),

    # ReviewReport
    make_entity('r_report', 'ReviewReport', [
        'reportId : INT [PK]',
        'reviewId : INT [FK, Unique]',
        'reason : VARCHAR(200)',
        'detail : TEXT [Nullable]',
        'reportedBy : VARCHAR(200)',
        'reportedDate : DATETIME',
        'status : VARCHAR(20)',
        'decidedBy : VARCHAR(200) [Nullable]',
        'decidedDate : DATETIME [Nullable]'
    ], 700, 320, 230, 185),

    # SalesStaff
    make_entity('r_sales', 'SalesStaff', [
        'staffId : INT [PK]',
        'personId : INT [FK]',
        'staffName : VARCHAR(100)',
        'role : VARCHAR(50)',
        'email : VARCHAR(100)'
    ], 80, 600, 210, 125),

    # StoreManager
    make_entity('r_manager', 'StoreManager', [
        'managerId : INT [PK]',
        'personId : INT [FK]',
        'managerName : VARCHAR(100)',
        'role : VARCHAR(50)',
        'email : VARCHAR(100)'
    ], 700, 600, 210, 125),
]

rev_relations = [
    # Customer -> Review (writes 0..N)
    make_relation('rr_c_r', 'r_cust', 'r_rev', 'writes (0..N)', exit_x=0.5, exit_y=1, entry_x=0.2, entry_y=0, points=[(180, 260), (426, 260)]),
    
    # Book -> Review (about 0..N)
    make_relation('rr_b_r', 'r_book', 'r_rev', 'about (0..N)', exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
    
    # Orders -> Review (verifies buy 0..1)
    make_relation('rr_o_r', 'r_order', 'r_rev', 'verifies buy (0..1)', exit_x=0.5, exit_y=1, entry_x=0.8, entry_y=0, points=[(810, 260), (564, 260)]),
    
    # Review -> ReviewReply (composition 0..N)
    make_relation('rr_r_rep', 'r_rev', 'r_reply', 'contains (0..N)', is_composition=True, exit_x=0, exit_y=0.5, entry_x=1, entry_y=0.5),
    
    # Review -> ReviewReport (escalates 0..1)
    make_relation('rr_r_rep2', 'r_rev', 'r_report', 'escalates (0..1)', exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
    
    # SalesStaff -> ReviewReply (replies 0..N)
    make_relation('rr_s_rep', 'r_sales', 'r_reply', 'replies', exit_x=0.5, exit_y=0, entry_x=0.5, entry_y=1),
    
    # SalesStaff -> ReviewReport (reports 0..N)
    make_relation('rr_s_rep2', 'r_sales', 'r_report', 'reports', exit_x=1, exit_y=0.5, entry_x=0.2, entry_y=1, points=[(340, 662), (746, 662)]),
    
    # StoreManager -> ReviewReport (decides / resolves 0..N)
    make_relation('rr_m_rep', 'r_manager', 'r_report', 'decides / resolves', exit_x=0.5, exit_y=0, entry_x=0.5, entry_y=1),
]

tab3_xml = build_tab(
    'tab_review',
    'ระบบจัดการรีวิว (Review)',
    'Class Diagram (Relational Database Schema) - ระบบจัดการรีวิวลูกค้า (Review Subsystem)',
    rev_entities,
    rev_relations,
    canvas_w=1080,
    canvas_h=800
)

# Combine into single mxfile
final_xml = f'''<mxfile host="app.diagrams.net" modified="2026-09-10T09:35:00.000Z" agent="Antigravity" version="21.0.0" type="device">
{tab1_xml}
{tab2_xml}
{tab3_xml}
</mxfile>'''

# Save to classdiagram1.drawio, classdiagram1, classdiagram.drawio, classdiagram
filenames = ['classdiagram1.drawio', 'classdiagram1', 'classdiagram.drawio', 'classdiagram']
for fn in filenames:
    with open(fn, 'w', encoding='utf-8') as f:
        f.write(final_xml)

print('Generated all requested class diagram files successfully!')
