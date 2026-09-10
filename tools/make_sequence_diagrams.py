# -*- coding: utf-8 -*-
"""
Generate complete Sequence Diagrams for Bookstore T03:
Delivery Subsystem (U1-U4) and Review Subsystem (U5-U8)
Supports both Thai and English versions.
Matches the exact style of the user's uploaded example image:
- Outer canvas frame with top-left angled tab (SD: ...)
- 4 Lifelines: [Actor], [Boundary/Screen], [Control/System], [Entity/Database]
- Activation bars (white vertical rectangles)
- Synchronous calls (solid line, filled arrow)
- Returns / Responses (dashed line, open arrow)
- Self-calls (internal validation)
- 'alt' fragments (alternative blocks with conditions and dashed dividers)
"""
import os
import html

def make_sequence_xml(diag_id, diag_name, tab_title, actor_title, screen_title, system_title, db_title, steps, alt_config=None, canvas_w=980, canvas_h=1050):
    """
    Builds a single <diagram> XML tab for a 4-lifeline Sequence Diagram.
    """
    out = []
    out.append(f'  <diagram id="{diag_id}" name="{html.escape(diag_name)}">')
    out.append(f'    <mxGraphModel dx="1100" dy="950" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{canvas_w}" pageHeight="{canvas_h}" math="0" shadow="0">')
    out.append('      <root>')
    out.append('        <mxCell id="0" />')
    out.append('        <mxCell id="1" parent="0" />')
    
    # Outer Frame
    out.append(f'        <mxCell id="frame_{diag_id}" value="" style="shape=rect;html=1;whiteSpace=wrap;fillColor=none;strokeColor=#000000;strokeWidth=1.5;" vertex="1" parent="1">')
    out.append(f'          <mxGeometry x="30" y="25" width="{canvas_w - 60}" height="{canvas_h - 50}" as="geometry" />')
    out.append('        </mxCell>')
    
    # Top Tab Header
    out.append(f'        <mxCell id="tab_{diag_id}" value="&lt;b&gt;{html.escape(tab_title)}&lt;/b&gt;" style="shape=folder;tabWidth=420;tabHeight=26;tabPosition=left;html=1;whiteSpace=wrap;fillColor=none;strokeColor=#000000;strokeWidth=1.5;fontSize=12;fontFamily=TH SarabunPSK, Tahoma, sans-serif;spacingLeft=10;verticalAlign=middle;align=left;" vertex="1" parent="1">')
    out.append(f'          <mxGeometry x="30" y="25" width="440" height="26" as="geometry" />')
    out.append('        </mxCell>')
    
    # X Positions for Lifelines
    x_actor = 100
    x_screen = 320
    x_sys = 590
    x_db = 830
    y_start = 80
    y_bottom = canvas_h - 60
    
    # 1. Actor
    out.append(f'        <mxCell id="act_{diag_id}" value="{html.escape(actor_title)}" style="shape=umlActor;verticalLabelPosition=top;verticalAlign=bottom;html=1;outlineConnect=0;strokeColor=#000000;fillColor=#ffffff;strokeWidth=1.5;fontSize=12;fontStyle=1;fontFamily=TH SarabunPSK, Tahoma, sans-serif;" vertex="1" parent="1">')
    out.append(f'          <mxGeometry x="{x_actor - 15}" y="{y_start}" width="30" height="55" as="geometry" />')
    out.append('        </mxCell>')
    out.append(f'        <mxCell id="line_act_{diag_id}" style="endArrow=none;dashed=1;html=1;strokeColor=#000000;strokeWidth=1;" edge="1" parent="1">')
    out.append(f'          <mxGeometry relative="1" as="geometry"><mxPoint x="{x_actor}" y="{y_start + 60}" as="sourcePoint" /><mxPoint x="{x_actor}" y="{y_bottom}" as="targetPoint" /></mxGeometry>')
    out.append('        </mxCell>')
    
    # 2. Screen Box
    out.append(f'        <mxCell id="box_scr_{diag_id}" value="&lt;b&gt;{html.escape(screen_title)}&lt;/b&gt;" style="shape=rect;html=1;whiteSpace=wrap;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.5;fontStyle=1;fontSize=12;align=center;verticalAlign=middle;fontFamily=TH SarabunPSK, Tahoma, sans-serif;" vertex="1" parent="1">')
    out.append(f'          <mxGeometry x="{x_screen - 65}" y="{y_start + 10}" width="130" height="45" as="geometry" />')
    out.append('        </mxCell>')
    out.append(f'        <mxCell id="line_scr_{diag_id}" style="endArrow=none;dashed=1;html=1;strokeColor=#000000;strokeWidth=1;" edge="1" parent="1">')
    out.append(f'          <mxGeometry relative="1" as="geometry"><mxPoint x="{x_screen}" y="{y_start + 55}" as="sourcePoint" /><mxPoint x="{x_screen}" y="{y_bottom}" as="targetPoint" /></mxGeometry>')
    out.append('        </mxCell>')
    
    # 3. System Box
    out.append(f'        <mxCell id="box_sys_{diag_id}" value="&lt;b&gt;{html.escape(system_title)}&lt;/b&gt;" style="shape=rect;html=1;whiteSpace=wrap;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.5;fontStyle=1;fontSize=12;align=center;verticalAlign=middle;fontFamily=TH SarabunPSK, Tahoma, sans-serif;" vertex="1" parent="1">')
    out.append(f'          <mxGeometry x="{x_sys - 70}" y="{y_start + 10}" width="140" height="45" as="geometry" />')
    out.append('        </mxCell>')
    out.append(f'        <mxCell id="line_sys_{diag_id}" style="endArrow=none;dashed=1;html=1;strokeColor=#000000;strokeWidth=1;" edge="1" parent="1">')
    out.append(f'          <mxGeometry relative="1" as="geometry"><mxPoint x="{x_sys}" y="{y_start + 55}" as="sourcePoint" /><mxPoint x="{x_sys}" y="{y_bottom}" as="targetPoint" /></mxGeometry>')
    out.append('        </mxCell>')
    
    # 4. Database Box
    out.append(f'        <mxCell id="box_db_{diag_id}" value="&lt;b&gt;{html.escape(db_title)}&lt;/b&gt;" style="shape=rect;html=1;whiteSpace=wrap;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.5;fontStyle=1;fontSize=12;align=center;verticalAlign=middle;fontFamily=TH SarabunPSK, Tahoma, sans-serif;" vertex="1" parent="1">')
    out.append(f'          <mxGeometry x="{x_db - 65}" y="{y_start + 10}" width="130" height="45" as="geometry" />')
    out.append('        </mxCell>')
    out.append(f'        <mxCell id="line_db_{diag_id}" style="endArrow=none;dashed=1;html=1;strokeColor=#000000;strokeWidth=1;" edge="1" parent="1">')
    out.append(f'          <mxGeometry relative="1" as="geometry"><mxPoint x="{x_db}" y="{y_start + 55}" as="sourcePoint" /><mxPoint x="{x_db}" y="{y_bottom}" as="targetPoint" /></mxGeometry>')
    out.append('        </mxCell>')
    
    # Main Actor Activation Bar
    out.append(f'        <mxCell id="bar_act_{diag_id}" value="" style="html=1;points=[];perimeter=orthogonalPerimeter;strokeColor=#000000;fillColor=#ffffff;strokeWidth=1;" vertex="1" parent="1">')
    out.append(f'          <mxGeometry x="{x_actor - 5}" y="{y_start + 85}" width="10" height="{y_bottom - y_start - 120}" as="geometry" />')
    out.append('        </mxCell>')

    # Add alt fragment if configured
    if alt_config:
        alt_y = alt_config['y']
        alt_h = alt_config['h']
        cond1 = alt_config['cond1']
        cond2 = alt_config['cond2']
        div_y = alt_config['div_y']
        
        # alt frame
        out.append(f'        <mxCell id="alt_box_{diag_id}" value="alt" style="shape=umlFrame;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;strokeWidth=1.5;width=45;height=20;fontSize=11;fontStyle=1;fontFamily=TH SarabunPSK, Tahoma, sans-serif;" vertex="1" parent="1">')
        out.append(f'          <mxGeometry x="50" y="{alt_y}" width="{canvas_w - 100}" height="{alt_h}" as="geometry" />')
        out.append('        </mxCell>')
        # cond 1 label
        out.append(f'        <mxCell id="alt_lbl1_{diag_id}" value="[{html.escape(cond1)}]" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=top;whiteSpace=wrap;fontSize=10;fontStyle=1;fontFamily=TH SarabunPSK, Tahoma, sans-serif;" vertex="1" parent="1">')
        out.append(f'          <mxGeometry x="110" y="{alt_y + 4}" width="600" height="20" as="geometry" />')
        out.append('        </mxCell>')
        # divider dashed line
        out.append(f'        <mxCell id="alt_div_{diag_id}" style="endArrow=none;dashed=1;html=1;strokeColor=#000000;strokeWidth=1;" edge="1" parent="1">')
        out.append(f'          <mxGeometry relative="1" as="geometry"><mxPoint x="50" y="{div_y}" as="sourcePoint" /><mxPoint x="{canvas_w - 50}" y="{div_y}" as="targetPoint" /></mxGeometry>')
        out.append('        </mxCell>')
        # cond 2 label
        out.append(f'        <mxCell id="alt_lbl2_{diag_id}" value="[{html.escape(cond2)}]" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=top;whiteSpace=wrap;fontSize=10;fontStyle=1;fontFamily=TH SarabunPSK, Tahoma, sans-serif;" vertex="1" parent="1">')
        out.append(f'          <mxGeometry x="110" y="{div_y + 4}" width="600" height="20" as="geometry" />')
        out.append('        </mxCell>')

    # Steps / Messages
    lane_x = {
        'actor': x_actor,
        'screen': x_screen,
        'system': x_sys,
        'db': x_db
    }
    
    for idx, st in enumerate(steps, 1):
        src_lane = st['from']
        tgt_lane = st['to']
        msg = st['msg']
        y_pos = st['y']
        is_return = st.get('is_return', False)
        is_self = st.get('is_self', False)
        
        x_from = lane_x[src_lane]
        x_to = lane_x[tgt_lane]
        
        # Draw activation bar on target if not self
        if not is_return and not is_self and tgt_lane in ['screen', 'system', 'db']:
            h_bar = st.get('bar_h', 45)
            out.append(f'        <mxCell id="bar_{diag_id}_{idx}" value="" style="html=1;points=[];perimeter=orthogonalPerimeter;strokeColor=#000000;fillColor=#ffffff;strokeWidth=1;" vertex="1" parent="1">')
            out.append(f'          <mxGeometry x="{x_to - 5}" y="{y_pos}" width="10" height="{h_bar}" as="geometry" />')
            out.append('        </mxCell>')
            
        if is_self:
            # Self call (elbow looping back to self)
            lbl = f"{idx}. {msg}"
            out.append(f'        <mxCell id="msg_{diag_id}_{idx}" value="{html.escape(lbl)}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#000000;strokeWidth=1;endArrow=classic;endFill=1;fontSize=10;fontFamily=TH SarabunPSK, Tahoma, sans-serif;align=left;spacingLeft=5;" edge="1" parent="1">')
            out.append(f'          <mxGeometry relative="1" as="geometry"><mxPoint x="{x_from + 5}" y="{y_pos}" as="sourcePoint" /><mxPoint x="{x_from + 5}" y="{y_pos + 22}" as="targetPoint" /><Array as="points"><mxPoint x="{x_from + 30}" y="{y_pos}" /><mxPoint x="{x_from + 30}" y="{y_pos + 22}" /></Array></mxGeometry>')
            out.append('        </mxCell>')
        elif is_return:
            # Return message (dashed line, open arrowhead)
            lbl = f"{idx}. {msg}"
            out.append(f'        <mxCell id="msg_{diag_id}_{idx}" value="{html.escape(lbl)}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;dashed=1;strokeColor=#000000;strokeWidth=1;endArrow=open;endSize=8;fontSize=10;fontFamily=TH SarabunPSK, Tahoma, sans-serif;" edge="1" parent="1">')
            out.append(f'          <mxGeometry relative="1" as="geometry"><mxPoint x="{x_from}" y="{y_pos}" as="sourcePoint" /><mxPoint x="{x_to}" y="{y_pos}" as="targetPoint" /></mxGeometry>')
            out.append('        </mxCell>')
        else:
            # Call message (solid line, filled block arrowhead)
            lbl = f"{idx}. {msg}"
            out.append(f'        <mxCell id="msg_{diag_id}_{idx}" value="{html.escape(lbl)}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#000000;strokeWidth=1;endArrow=block;fontSize=10;fontFamily=TH SarabunPSK, Tahoma, sans-serif;" edge="1" parent="1">')
            out.append(f'          <mxGeometry relative="1" as="geometry"><mxPoint x="{x_from}" y="{y_pos}" as="sourcePoint" /><mxPoint x="{x_to}" y="{y_pos}" as="targetPoint" /></mxGeometry>')
            out.append('        </mxCell>')

    out.append('      </root>')
    out.append('    </mxGraphModel>')
    out.append('  </diagram>')
    return '\n'.join(out)

# ==============================================================================
# DATA DEFINITIONS FOR ALL 8 USE CASES (THAI & ENGLISH)
# ==============================================================================

# --- U1 ---
u1_th_steps = [
    {'from': 'actor', 'to': 'screen', 'msg': 'เข้าสู่ระบบและเปิดหน้ารายการคำสั่งซื้อที่รอจัดเตรียม', 'y': 170, 'bar_h': 80},
    {'from': 'screen', 'to': 'system', 'msg': 'ดึงรายการคำสั่งซื้อสถานะ "ชำระเงินแล้ว" (getPaidOrders)', 'y': 190, 'bar_h': 50},
    {'from': 'system', 'to': 'db', 'msg': 'SELECT * FROM customer_order WHERE status = \'PAID\'', 'y': 210, 'bar_h': 30},
    {'from': 'db', 'to': 'system', 'msg': 'ส่งคืนรายการคำสั่งซื้อที่ชำระเงินแล้ว', 'y': 235, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'ส่งข้อมูลรายการออเดอร์ ข้อมูลผู้รับ และรายการหนังสือ', 'y': 250, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'แสดงรายการคำสั่งซื้อและรายละเอียดการแพ็กหนังสือ', 'y': 265, 'is_return': True},
    {'from': 'actor', 'to': 'actor', 'msg': 'หยิบหนังสือ ตรวจสอบสภาพ และบรรจุหีบห่อลงกล่องพัสดุ', 'y': 295, 'is_self': True},
    # alt branch 1
    {'from': 'actor', 'to': 'screen', 'msg': 'กดปุ่ม "ระงับคำสั่งซื้อเนื่องจากสินค้าไม่พอ"', 'y': 380, 'bar_h': 60},
    {'from': 'screen', 'to': 'system', 'msg': 'ส่งคำขอระงับคำสั่งซื้อ holdOrder(orderId, note)', 'y': 400, 'bar_h': 40},
    {'from': 'system', 'to': 'db', 'msg': 'UPDATE customer_order SET status = \'ON_HOLD\'', 'y': 420, 'bar_h': 20},
    {'from': 'db', 'to': 'system', 'msg': 'ยืนยันปรับสถานะระงับคำสั่งซื้อชั่วคราว', 'y': 435, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'แจ้งเตือนฝ่ายขายและส่งผลการระงับคำสั่งซื้อ', 'y': 450, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'แสดงข้อความ "ระงับคำสั่งซื้อและแจ้งเตือนฝ่ายขายเรียบร้อย"', 'y': 465, 'is_return': True},
    # alt branch 2
    {'from': 'actor', 'to': 'screen', 'msg': 'กดปุ่ม "เริ่มแพ็กสินค้า" และ "แพ็กสินค้าเสร็จพร้อมส่ง"', 'y': 560, 'bar_h': 80},
    {'from': 'screen', 'to': 'system', 'msg': 'ส่งคำขอยืนยันการบรรจุพัสดุ confirmPacking(orderId)', 'y': 580, 'bar_h': 60},
    {'from': 'system', 'to': 'db', 'msg': 'INSERT INTO shipment, UPDATE customer_order SET status=\'PREPARING\'', 'y': 600, 'bar_h': 30},
    {'from': 'db', 'to': 'system', 'msg': 'ยืนยันสร้างเรคคอร์ดพัสดุและปรับสถานะสำเร็จ', 'y': 625, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'ส่งผลลัพธ์การเปลี่ยนสถานะเป็น "พร้อมจัดส่ง"', 'y': 640, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'แสดงข้อความ "แพ็กสินค้าเสร็จสิ้น - สถานะพร้อมจัดส่ง"', 'y': 655, 'is_return': True},
]
u1_th_alt = {'y': 335, 'h': 365, 'div_y': 515, 'cond1': 'สินค้าไม่เพียงพอ / ชำรุด (Out of Stock / Damage)', 'cond2': 'สินค้าเพียงพอและสมบูรณ์ (Items in Stock - Ready to Pack)'}

u1_en_steps = [
    {'from': 'actor', 'to': 'screen', 'msg': 'Login and open Orders Queue page', 'y': 170, 'bar_h': 80},
    {'from': 'screen', 'to': 'system', 'msg': 'Request paid orders list (getPaidOrders)', 'y': 190, 'bar_h': 50},
    {'from': 'system', 'to': 'db', 'msg': 'SELECT * FROM customer_order WHERE status = \'PAID\'', 'y': 210, 'bar_h': 30},
    {'from': 'db', 'to': 'system', 'msg': 'Return paid orders recordset', 'y': 235, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'Return order queue data & book items', 'y': 250, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'Display order queue and packing details', 'y': 265, 'is_return': True},
    {'from': 'actor', 'to': 'actor', 'msg': 'Pick books, inspect condition & pack into parcel', 'y': 295, 'is_self': True},
    # alt 1
    {'from': 'actor', 'to': 'screen', 'msg': 'Click "Hold Order due to Out of Stock"', 'y': 380, 'bar_h': 60},
    {'from': 'screen', 'to': 'system', 'msg': 'Send holdOrder(orderId, note) request', 'y': 400, 'bar_h': 40},
    {'from': 'system', 'to': 'db', 'msg': 'UPDATE customer_order SET status = \'ON_HOLD\'', 'y': 420, 'bar_h': 20},
    {'from': 'db', 'to': 'system', 'msg': 'Confirm order on-hold update', 'y': 435, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'Notify Sales Staff & return hold status', 'y': 450, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'Display "Order Placed On Hold & Alert Sent"', 'y': 465, 'is_return': True},
    # alt 2
    {'from': 'actor', 'to': 'screen', 'msg': 'Click "Start Packing" & "Packing Completed"', 'y': 560, 'bar_h': 80},
    {'from': 'screen', 'to': 'system', 'msg': 'Send confirmPacking(orderId) request', 'y': 580, 'bar_h': 60},
    {'from': 'system', 'to': 'db', 'msg': 'INSERT INTO shipment, UPDATE customer_order SET status=\'PREPARING\'', 'y': 600, 'bar_h': 30},
    {'from': 'db', 'to': 'system', 'msg': 'Confirm shipment created & status updated', 'y': 625, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'Return ready-to-ship confirmation', 'y': 640, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'Display "Packing Completed - Ready for Shipping"', 'y': 655, 'is_return': True},
]
u1_en_alt = {'y': 335, 'h': 365, 'div_y': 515, 'cond1': 'Out of Stock / Damaged Item', 'cond2': 'Items In Stock - Ready to Pack'}

# --- U2 ---
u2_th_steps = [
    {'from': 'actor', 'to': 'screen', 'msg': 'เปิดหน้ารายการคำสั่งซื้อที่พร้อมจัดส่ง', 'y': 170, 'bar_h': 60},
    {'from': 'screen', 'to': 'system', 'msg': 'ดึงข้อมูลออเดอร์พร้อมส่งและรายชื่อขนส่ง getReadyShipments()', 'y': 190, 'bar_h': 40},
    {'from': 'system', 'to': 'db', 'msg': 'SELECT * FROM shipment WHERE status = \'PREPARING\'', 'y': 210, 'bar_h': 20},
    {'from': 'db', 'to': 'system', 'msg': 'ส่งคืนข้อมูลคำสั่งซื้อและบริษัทขนส่ง', 'y': 225, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'แสดงรายการคำสั่งซื้อและฟอร์มบันทึกการจัดส่ง', 'y': 240, 'is_return': True},
    {'from': 'actor', 'to': 'screen', 'msg': 'เลือกคำสั่งซื้อ เลือกบริษัทขนส่ง และกรอกหมายเลขพัสดุ (Tracking No.)', 'y': 270, 'bar_h': 50},
    {'from': 'actor', 'to': 'screen', 'msg': 'กดปุ่ม "บันทึกข้อมูลการจัดส่ง"', 'y': 300, 'bar_h': 40},
    {'from': 'screen', 'to': 'system', 'msg': 'ส่งคำขอบันทึก recordDelivery(orderId, carrierId, trackingNumber)', 'y': 320, 'bar_h': 60},
    {'from': 'system', 'to': 'system', 'msg': 'ตรวจสอบความถูกต้องและเช็กเลขพัสดุซ้ำในระบบ', 'y': 345, 'is_self': True},
    # alt 1
    {'from': 'system', 'to': 'screen', 'msg': 'ส่งข้อผิดพลาด "หมายเลขพัสดุซ้ำในระบบหรือข้อมูลไม่ครบถ้วน"', 'y': 420, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'แสดงข้อความแจ้งเตือนข้อผิดพลาดและให้ระบุข้อมูลใหม่', 'y': 440, 'is_return': True},
    # alt 2
    {'from': 'system', 'to': 'db', 'msg': 'UPDATE shipment SET tracking_number, status=\'SHIPPED\'', 'y': 525, 'bar_h': 30},
    {'from': 'db', 'to': 'system', 'msg': 'ยืนยันบันทึกข้อมูลและปรับปรุงสถานะสำเร็จ', 'y': 550, 'is_return': True},
    {'from': 'system', 'to': 'system', 'msg': 'ส่งการแจ้งเตือนเลขพัสดุและลิงก์ติดตามไปยังลูกค้าอัตโนมัติ', 'y': 570, 'is_self': True},
    {'from': 'system', 'to': 'screen', 'msg': 'ส่งผลการบันทึกจัดส่งสำเร็จ (Shipped)', 'y': 610, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'แสดงข้อความ "บันทึกข้อมูลการจัดส่งสำเร็จ - สถานะจัดส่งแล้ว"', 'y': 630, 'is_return': True},
]
u2_th_alt = {'y': 385, 'h': 295, 'div_y': 485, 'cond1': 'เลขพัสดุซ้ำ หรือข้อมูลไม่ครบถ้วน (Duplicate / Invalid Input)', 'cond2': 'ข้อมูลถูกต้องและไม่ซ้ำ (Valid & Unique Tracking Number)'}

u2_en_steps = [
    {'from': 'actor', 'to': 'screen', 'msg': 'Open Ready-to-Ship Orders page', 'y': 170, 'bar_h': 60},
    {'from': 'screen', 'to': 'system', 'msg': 'Request ready shipments & carriers list getReadyShipments()', 'y': 190, 'bar_h': 40},
    {'from': 'system', 'to': 'db', 'msg': 'SELECT * FROM shipment WHERE status = \'PREPARING\'', 'y': 210, 'bar_h': 20},
    {'from': 'db', 'to': 'system', 'msg': 'Return shipments and carriers data', 'y': 225, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'Display ready orders & carrier selection form', 'y': 240, 'is_return': True},
    {'from': 'actor', 'to': 'screen', 'msg': 'Select order, choose carrier, and input Tracking Number', 'y': 270, 'bar_h': 50},
    {'from': 'actor', 'to': 'screen', 'msg': 'Click "Record Delivery Info" button', 'y': 300, 'bar_h': 40},
    {'from': 'screen', 'to': 'system', 'msg': 'Send recordDelivery(orderId, carrierId, trackingNumber)', 'y': 320, 'bar_h': 60},
    {'from': 'system', 'to': 'system', 'msg': 'Validate input format & check duplicate tracking number', 'y': 345, 'is_self': True},
    # alt 1
    {'from': 'system', 'to': 'screen', 'msg': 'Return error "Duplicate tracking number or invalid input"', 'y': 420, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'Display error warning message & prompt for correction', 'y': 440, 'is_return': True},
    # alt 2
    {'from': 'system', 'to': 'db', 'msg': 'UPDATE shipment SET tracking_number, status=\'SHIPPED\'', 'y': 525, 'bar_h': 30},
    {'from': 'db', 'to': 'system', 'msg': 'Confirm shipment updated to SHIPPED', 'y': 550, 'is_return': True},
    {'from': 'system', 'to': 'system', 'msg': 'Trigger auto-notification & tracking link to customer', 'y': 570, 'is_self': True},
    {'from': 'system', 'to': 'screen', 'msg': 'Return delivery record success response', 'y': 610, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'Display "Delivery Info Recorded Successfully (Shipped)"', 'y': 630, 'is_return': True},
]
u2_en_alt = {'y': 385, 'h': 295, 'div_y': 485, 'cond1': 'Duplicate Tracking Number OR Invalid Input', 'cond2': 'Valid & Unique Tracking Number'}

# --- U3 ---
u3_th_steps = [
    {'from': 'actor', 'to': 'screen', 'msg': 'เข้าสู่ระบบและเลือกเมนู "คำสั่งซื้อ / ติดตามสถานะพัสดุ"', 'y': 170, 'bar_h': 60},
    {'from': 'screen', 'to': 'system', 'msg': 'ดึงประวัติคำสั่งซื้อของลูกค้า getCustomerOrders()', 'y': 190, 'bar_h': 40},
    {'from': 'system', 'to': 'db', 'msg': 'SELECT * FROM customer_order WHERE customer_id = ?', 'y': 210, 'bar_h': 20},
    {'from': 'db', 'to': 'system', 'msg': 'ส่งคืนรายการคำสั่งซื้อทั้งหมด', 'y': 225, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'แสดงรายการคำสั่งซื้อและสถานะภาพรวม', 'y': 240, 'is_return': True},
    {'from': 'actor', 'to': 'screen', 'msg': 'เลือกรายการคำสั่งซื้อที่ต้องการตรวจสอบพัสดุ', 'y': 270, 'bar_h': 40},
    {'from': 'screen', 'to': 'system', 'msg': 'ส่งคำขอตรวจสอบ trackOrderShipment(orderId)', 'y': 295, 'bar_h': 60},
    {'from': 'system', 'to': 'db', 'msg': 'SELECT * FROM shipment WHERE order_id = ?', 'y': 315, 'bar_h': 30},
    {'from': 'db', 'to': 'system', 'msg': 'ส่งคืนข้อมูลการจัดส่งและประวัติไทม์ไลน์', 'y': 340, 'is_return': True},
    # alt 1
    {'from': 'system', 'to': 'screen', 'msg': 'แจ้งสถานะ "กำลังจัดเตรียมสินค้า ยังไม่มีหมายเลขพัสดุ"', 'y': 415, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'แสดงข้อความ "ทางร้านกำลังจัดเตรียมและแพ็กสินค้าเพื่อจัดส่ง"', 'y': 435, 'is_return': True},
    # alt 2
    {'from': 'system', 'to': 'screen', 'msg': 'ส่งข้อมูลสรุปผู้รับ, ขนส่ง, เลขพัสดุ, สถานะ และไทม์ไลน์', 'y': 515, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'แสดงสรุปสถานะพัสดุและไทม์ไลน์การเดินทางแต่ละจุดคัดแยก', 'y': 535, 'is_return': True},
    {'from': 'actor', 'to': 'screen', 'msg': 'คลิก "ปุ่มคัดลอก" เพื่อเปิดหน้าเว็บตรวจสอบภายนอกของขนส่ง', 'y': 565, 'bar_h': 35},
    {'from': 'screen', 'to': 'actor', 'msg': 'คัดลอกเลขพัสดุและเปิดหน้าเว็บติดตามของบริษัทขนส่ง', 'y': 590, 'is_return': True},
]
u3_th_alt = {'y': 375, 'h': 260, 'div_y': 475, 'cond1': 'ไม่พบเลขพัสดุ หรืออยู่ระหว่างเตรียมของ (Preparing / No Tracking Yet)', 'cond2': 'พบข้อมูลการจัดส่งและเลขพัสดุ (Shipment Shipped / Delivered)'}

u3_en_steps = [
    {'from': 'actor', 'to': 'screen', 'msg': 'Login and navigate to "Order Tracking" menu', 'y': 170, 'bar_h': 60},
    {'from': 'screen', 'to': 'system', 'msg': 'Request customer orders history getCustomerOrders()', 'y': 190, 'bar_h': 40},
    {'from': 'system', 'to': 'db', 'msg': 'SELECT * FROM customer_order WHERE customer_id = ?', 'y': 210, 'bar_h': 20},
    {'from': 'db', 'to': 'system', 'msg': 'Return customer orders list', 'y': 225, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'Display orders overview and status list', 'y': 240, 'is_return': True},
    {'from': 'actor', 'to': 'screen', 'msg': 'Select target order to track shipment progress', 'y': 270, 'bar_h': 40},
    {'from': 'screen', 'to': 'system', 'msg': 'Send trackOrderShipment(orderId) request', 'y': 295, 'bar_h': 60},
    {'from': 'system', 'to': 'db', 'msg': 'SELECT * FROM shipment WHERE order_id = ?', 'y': 315, 'bar_h': 30},
    {'from': 'db', 'to': 'system', 'msg': 'Return shipment record and tracking timeline', 'y': 340, 'is_return': True},
    # alt 1
    {'from': 'system', 'to': 'screen', 'msg': 'Return status "Shipment is being prepared, no tracking yet"', 'y': 415, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'Display "Store is preparing and packing items for shipment"', 'y': 435, 'is_return': True},
    # alt 2
    {'from': 'system', 'to': 'screen', 'msg': 'Return recipient, carrier, tracking number, status & timeline', 'y': 515, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'Render shipment tracking summary and transit timeline', 'y': 535, 'is_return': True},
    {'from': 'actor', 'to': 'screen', 'msg': 'Click "Copy Button" to open external carrier tracking website', 'y': 565, 'bar_h': 35},
    {'from': 'screen', 'to': 'actor', 'msg': 'Copy tracking number and launch carrier tracking portal', 'y': 590, 'is_return': True},
]
u3_en_alt = {'y': 375, 'h': 260, 'div_y': 475, 'cond1': 'Shipment Preparing / No Tracking Assigned', 'cond2': 'Shipment Shipped / Active Tracking Timeline'}

# --- U4 ---
u4_th_steps = [
    {'from': 'actor', 'to': 'screen', 'msg': 'เปิดเมนู "รายงานสรุปบัญชีพัสดุจัดส่ง" (Delivery Summary)', 'y': 170, 'bar_h': 50},
    {'from': 'screen', 'to': 'actor', 'msg': 'แสดงหน้าจอตัวกรองช่วงวันที่ (Date Range) และตัวเลือกสรุปประจำวัน', 'y': 200, 'is_return': True},
    {'from': 'actor', 'to': 'screen', 'msg': 'เลือกช่วงวันที่ที่ต้องการออกรายงานสรุป', 'y': 230, 'bar_h': 40},
    {'from': 'actor', 'to': 'screen', 'msg': 'กดปุ่ม "ประมวลผลรายงานสรุป"', 'y': 260, 'bar_h': 40},
    {'from': 'screen', 'to': 'system', 'msg': 'ส่งคำขอประมวลผล generateDeliverySummary(startDate, endDate)', 'y': 285, 'bar_h': 60},
    {'from': 'system', 'to': 'db', 'msg': 'SELECT * FROM shipment WHERE shipped_date BETWEEN ? AND ?', 'y': 310, 'bar_h': 30},
    {'from': 'db', 'to': 'system', 'msg': 'ส่งคืนข้อมูลรายการจัดส่งพัสดุในช่วงเวลา', 'y': 335, 'is_return': True},
    # alt 1
    {'from': 'system', 'to': 'screen', 'msg': 'ส่งสถานะ "ไม่พบรายการจัดส่งในช่วงเวลาที่ระบุ"', 'y': 415, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'แสดงสถานะว่าง (Empty State) "ไม่พบรายการจัดส่งในช่วงเวลาที่ระบุ"', 'y': 435, 'is_return': True},
    # alt 2
    {'from': 'system', 'to': 'system', 'msg': 'คำนวณยอดรวมพัสดุ สถิติแยกตามขนส่ง และอัตราส่งสำเร็จ', 'y': 515, 'is_self': True},
    {'from': 'system', 'to': 'db', 'msg': 'INSERT INTO delivery_summary (summary_date, total_parcels, ...)', 'y': 555, 'bar_h': 25},
    {'from': 'db', 'to': 'system', 'msg': 'ยืนยันบันทึกประวัติรายงานสรุปยอด', 'y': 575, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'ส่งผลลัพธ์ข้อมูลรายงานสรุป (ตารางสถิติและข้อมูลแผนภูมิ)', 'y': 595, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'แสดงผลรายงานสรุปบนแดชบอร์ดในรูปแบบตารางและกราฟ', 'y': 615, 'is_return': True},
    {'from': 'actor', 'to': 'screen', 'msg': 'กดปุ่ม "ส่งออกรายงาน (Export CSV/PDF)" เพื่อส่งให้ผู้จัดการตรวจ', 'y': 645, 'bar_h': 35},
    {'from': 'screen', 'to': 'actor', 'msg': 'ดาวน์โหลดไฟล์รายงานสรุปบัญชีการจัดส่งสำเร็จ', 'y': 670, 'is_return': True},
]
u4_th_alt = {'y': 375, 'h': 330, 'div_y': 475, 'cond1': 'ไม่พบข้อมูลการจัดส่งในช่วงเวลา (No Delivery Records in Range)', 'cond2': 'พบรายการจัดส่ง (Delivery Records Exist - Generate Summary)'}

u4_en_steps = [
    {'from': 'actor', 'to': 'screen', 'msg': 'Open "Delivery Summary Report" page', 'y': 170, 'bar_h': 50},
    {'from': 'screen', 'to': 'actor', 'msg': 'Display date range filter form and daily summary option', 'y': 200, 'is_return': True},
    {'from': 'actor', 'to': 'screen', 'msg': 'Select target date range for summary', 'y': 230, 'bar_h': 40},
    {'from': 'actor', 'to': 'screen', 'msg': 'Click "Process Summary Report" button', 'y': 260, 'bar_h': 40},
    {'from': 'screen', 'to': 'system', 'msg': 'Send generateDeliverySummary(startDate, endDate) request', 'y': 285, 'bar_h': 60},
    {'from': 'system', 'to': 'db', 'msg': 'SELECT * FROM shipment WHERE shipped_date BETWEEN ? AND ?', 'y': 310, 'bar_h': 30},
    {'from': 'db', 'to': 'system', 'msg': 'Return shipment records in range', 'y': 335, 'is_return': True},
    # alt 1
    {'from': 'system', 'to': 'screen', 'msg': 'Return empty state response', 'y': 415, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'Display Empty State "No delivery records found for specified period"', 'y': 435, 'is_return': True},
    # alt 2
    {'from': 'system', 'to': 'system', 'msg': 'Aggregate total parcels, breakdown by carrier & success rate', 'y': 515, 'is_self': True},
    {'from': 'system', 'to': 'db', 'msg': 'INSERT INTO delivery_summary (summary_date, total_parcels, ...)', 'y': 555, 'bar_h': 25},
    {'from': 'db', 'to': 'system', 'msg': 'Confirm summary report snapshot saved', 'y': 575, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'Return aggregated summary data and chart metrics', 'y': 595, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'Render delivery summary dashboard and statistical charts', 'y': 615, 'is_return': True},
    {'from': 'actor', 'to': 'screen', 'msg': 'Click "Export CSV/PDF" to send to Store Manager', 'y': 645, 'bar_h': 35},
    {'from': 'screen', 'to': 'actor', 'msg': 'Download exported delivery summary document', 'y': 670, 'is_return': True},
]
u4_en_alt = {'y': 375, 'h': 330, 'div_y': 475, 'cond1': 'No Shipment Records Found in Range', 'cond2': 'Shipment Records Found - Compute & Save Summary'}

# --- U5 ---
u5_th_steps = [
    {'from': 'actor', 'to': 'screen', 'msg': 'เข้าสู่ระบบและเปิดหน้า "ประวัติการสั่งซื้อ"', 'y': 170, 'bar_h': 50},
    {'from': 'screen', 'to': 'system', 'msg': 'ตรวจสอบสถานะคำสั่งซื้อของหนังสือที่ซื้อ verifyPurchase(orderId, bookId)', 'y': 195, 'bar_h': 50},
    {'from': 'system', 'to': 'db', 'msg': 'SELECT status FROM customer_order WHERE order_id = ?', 'y': 220, 'bar_h': 20},
    {'from': 'db', 'to': 'system', 'msg': 'ส่งคืนสถานะคำสั่งซื้อปัจจุบัน', 'y': 235, 'is_return': True},
    # alt 1
    {'from': 'system', 'to': 'screen', 'msg': 'สถานะไม่ใช่ "จัดส่งสำเร็จ" (Delivered) ไม่อนุญาตให้รีวิว', 'y': 310, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'ไม่แสดงปุ่มเขียนรีวิว (แสดงข้อความ "รีวิวได้เฉพาะสินค้าที่ได้รับแล้ว")', 'y': 330, 'is_return': True},
    # alt 2
    {'from': 'system', 'to': 'screen', 'msg': 'ยืนยันสิทธิ์รีวิวสำเร็จ (Verified Purchase)', 'y': 410, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'แสดงกล่องเขียนรีวิวและระดับดาวให้คะแนน (1-5 ดาว)', 'y': 430, 'is_return': True},
    {'from': 'actor', 'to': 'screen', 'msg': 'เลือกคะแนนดาว พิมพ์ข้อความรีวิว และกดปุ่ม "ส่งรีวิว"', 'y': 460, 'bar_h': 40},
    {'from': 'screen', 'to': 'system', 'msg': 'ส่งคำขอ submitReview(bookId, orderId, rating, comment)', 'y': 485, 'bar_h': 70},
    {'from': 'system', 'to': 'system', 'msg': 'เรียกใช้ Profanity Filter ตรวจสอบคำหยาบคาย/คำต้องห้าม', 'y': 510, 'is_self': True},
    # alt sub
    {'from': 'system', 'to': 'db', 'msg': 'พบคำไม่สุภาพ: INSERT INTO review (status=\'PENDING\', flagged=true)', 'y': 585, 'bar_h': 25},
    {'from': 'db', 'to': 'system', 'msg': 'ยืนยันบันทึกรีวิวรอการตรวจสอบ', 'y': 605, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'แจ้ง "รีวิวของคุณอยู่ระหว่างรอเจ้าหน้าที่ตรวจสอบ"', 'y': 620, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'แสดงข้อความยืนยันการส่งรีวิวเข้าคิวตรวจสอบ', 'y': 635, 'is_return': True},
    # alt sub 2
    {'from': 'system', 'to': 'db', 'msg': 'ข้อความปกติ: INSERT INTO review (status=\'PUBLISHED\', flagged=false)', 'y': 710, 'bar_h': 25},
    {'from': 'db', 'to': 'system', 'msg': 'ยืนยันบันทึกรีวิวเผยแพร่สำเร็จ', 'y': 730, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'ส่งผลการเผยแพร่รีวิวหน้าร้านสำเร็จ', 'y': 745, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'แสดงข้อความยืนยัน "ส่งรีวิวสำเร็จและเผยแพร่หน้าร้านแล้ว"', 'y': 760, 'is_return': True},
]
u5_th_alt = {'y': 275, 'h': 520, 'div_y': 375, 'cond1': 'สถานะไม่ใช่ "จัดส่งสำเร็จ" (Order Status != Delivered)', 'cond2': 'จัดส่งสำเร็จ (Verified Purchase - Allowed to Review)'}

u5_en_steps = [
    {'from': 'actor', 'to': 'screen', 'msg': 'Login and open "Order History" page', 'y': 170, 'bar_h': 50},
    {'from': 'screen', 'to': 'system', 'msg': 'Verify purchase status verifyPurchase(orderId, bookId)', 'y': 195, 'bar_h': 50},
    {'from': 'system', 'to': 'db', 'msg': 'SELECT status FROM customer_order WHERE order_id = ?', 'y': 220, 'bar_h': 20},
    {'from': 'db', 'to': 'system', 'msg': 'Return current order delivery status', 'y': 235, 'is_return': True},
    # alt 1
    {'from': 'system', 'to': 'screen', 'msg': 'Status != DELIVERED (Review not permitted)', 'y': 310, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'Hide review button (Display "Reviews available upon delivery")', 'y': 330, 'is_return': True},
    # alt 2
    {'from': 'system', 'to': 'screen', 'msg': 'Confirm verified purchase permission', 'y': 410, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'Render review comment box & 1-5 star rating selector', 'y': 430, 'is_return': True},
    {'from': 'actor', 'to': 'screen', 'msg': 'Select star rating, type comment, and click "Submit Review"', 'y': 460, 'bar_h': 40},
    {'from': 'screen', 'to': 'system', 'msg': 'Send submitReview(bookId, orderId, rating, comment)', 'y': 485, 'bar_h': 70},
    {'from': 'system', 'to': 'system', 'msg': 'Execute Profanity Filter check on review comment', 'y': 510, 'is_self': True},
    # alt sub
    {'from': 'system', 'to': 'db', 'msg': 'Flagged word: INSERT INTO review (status=\'PENDING\', flagged=true)', 'y': 585, 'bar_h': 25},
    {'from': 'db', 'to': 'system', 'msg': 'Confirm pending review saved', 'y': 605, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'Return pending moderation status', 'y': 620, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'Display "Review submitted and pending staff moderation"', 'y': 635, 'is_return': True},
    # alt sub 2
    {'from': 'system', 'to': 'db', 'msg': 'Clean comment: INSERT INTO review (status=\'PUBLISHED\', flagged=false)', 'y': 710, 'bar_h': 25},
    {'from': 'db', 'to': 'system', 'msg': 'Confirm published review saved', 'y': 730, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'Return publish success response', 'y': 745, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'Display "Review Submitted Successfully & Published Live"', 'y': 760, 'is_return': True},
]
u5_en_alt = {'y': 275, 'h': 520, 'div_y': 375, 'cond1': 'Order Status != DELIVERED (Not Eligible)', 'cond2': 'Order Status == DELIVERED (Verified Purchase Eligible)'}

# --- U6 ---
u6_th_steps = [
    {'from': 'actor', 'to': 'screen', 'msg': 'ล็อกอินฝ่ายขาย และเปิดเมนู "ตรวจสอบรีวิว" (Review Moderation)', 'y': 170, 'bar_h': 60},
    {'from': 'screen', 'to': 'system', 'msg': 'ดึงรายการรีวิวพร้อมป้าย Flagged getModerationReviews()', 'y': 195, 'bar_h': 40},
    {'from': 'system', 'to': 'db', 'msg': 'SELECT * FROM review ORDER BY created_date DESC', 'y': 215, 'bar_h': 20},
    {'from': 'db', 'to': 'system', 'msg': 'ส่งคืนข้อมูลรายการรีวิวและสถานะการติดธง', 'y': 230, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'แสดงตารางรีวิวในระบบ พร้อมตัวกรองสถานะ', 'y': 245, 'is_return': True},
    {'from': 'actor', 'to': 'screen', 'msg': 'คลิกอ่านรายละเอียดรีวิวเพื่อตรวจสอบความถูกต้องของข้อความ', 'y': 275, 'bar_h': 40},
    # alt 1
    {'from': 'actor', 'to': 'screen', 'msg': 'พบข้อความผิดกฎ/สแปม: กดปุ่ม "รายงานผู้จัดการ (Report to Manager)"', 'y': 365, 'bar_h': 60},
    {'from': 'screen', 'to': 'system', 'msg': 'ส่งคำขอรายงาน reportReview(reviewId, reason, detail, reportedBy)', 'y': 390, 'bar_h': 50},
    {'from': 'system', 'to': 'db', 'msg': 'INSERT INTO review_report, UPDATE review SET status=\'PENDING\'', 'y': 415, 'bar_h': 25},
    {'from': 'db', 'to': 'system', 'msg': 'ยืนยันบันทึกรายงานปัญหาเข้าสู่ระบบ', 'y': 435, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'ส่งผลการรายงานและส่งเข้าคิวผู้จัดการร้านทันที', 'y': 450, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'แสดงข้อความ "ส่งรายงานข้อร้องเรียนถึงผู้จัดการร้านเรียบร้อยแล้ว"', 'y': 465, 'is_return': True},
    # alt 2
    {'from': 'actor', 'to': 'screen', 'msg': 'เนื้อหาเหมาะสมแต่มีข้อซักถาม: กดปุ่ม "ตอบกลับรีวิว" (ไป U7)', 'y': 555, 'bar_h': 40},
    {'from': 'screen', 'to': 'actor', 'msg': 'เปิดหน้าต่าง Modal เพื่อพิมพ์ข้อความตอบกลับอย่างเป็นทางการ', 'y': 580, 'is_return': True},
]
u6_th_alt = {'y': 325, 'h': 295, 'div_y': 515, 'cond1': 'พบข้อความไม่เหมาะสม/สแปมร้ายแรง (Report to Store Manager)', 'cond2': 'ข้อความเหมาะสมแต่ต้องการชี้แจง (Proceed to Reply - U7)'}

u6_en_steps = [
    {'from': 'actor', 'to': 'screen', 'msg': 'Login as Sales Staff and open "Review Moderation" page', 'y': 170, 'bar_h': 60},
    {'from': 'screen', 'to': 'system', 'msg': 'Request moderation reviews list getModerationReviews()', 'y': 195, 'bar_h': 40},
    {'from': 'system', 'to': 'db', 'msg': 'SELECT * FROM review ORDER BY created_date DESC', 'y': 215, 'bar_h': 20},
    {'from': 'db', 'to': 'system', 'msg': 'Return review records and flagged markers', 'y': 230, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'Display review moderation table with filters', 'y': 245, 'is_return': True},
    {'from': 'actor', 'to': 'screen', 'msg': 'Click review row to inspect content and order context', 'y': 275, 'bar_h': 40},
    # alt 1
    {'from': 'actor', 'to': 'screen', 'msg': 'Inappropriate content: Click "Report to Manager" button', 'y': 365, 'bar_h': 60},
    {'from': 'screen', 'to': 'system', 'msg': 'Send reportReview(reviewId, reason, detail, reportedBy)', 'y': 390, 'bar_h': 50},
    {'from': 'system', 'to': 'db', 'msg': 'INSERT INTO review_report, UPDATE review SET status=\'PENDING\'', 'y': 415, 'bar_h': 25},
    {'from': 'db', 'to': 'system', 'msg': 'Confirm report record created', 'y': 435, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'Return escalation success response', 'y': 450, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'Display "Review reported and escalated to Store Manager queue"', 'y': 465, 'is_return': True},
    # alt 2
    {'from': 'actor', 'to': 'screen', 'msg': 'Appropriate content with questions: Click "Reply to Review" (to U7)', 'y': 555, 'bar_h': 40},
    {'from': 'screen', 'to': 'actor', 'msg': 'Launch official reply dialog modal for staff input', 'y': 580, 'is_return': True},
]
u6_en_alt = {'y': 325, 'h': 295, 'div_y': 515, 'cond1': 'Violating Content / Severe Spam (Escalate to Manager)', 'cond2': 'Valid Content with Customer Query (Proceed to Reply - U7)'}

# --- U7 ---
u7_th_steps = [
    {'from': 'actor', 'to': 'screen', 'msg': 'เลือกรายการรีวิวที่ต้องการตอบกลับ และคลิกปุ่ม "ตอบกลับรีวิว"', 'y': 170, 'bar_h': 50},
    {'from': 'screen', 'to': 'actor', 'msg': 'แสดงหน้าต่าง Modal ข้อมูลรีวิวเดิมและช่องกรอกข้อความตอบกลับ', 'y': 200, 'is_return': True},
    {'from': 'actor', 'to': 'screen', 'msg': 'พิมพ์ข้อความชี้แจง ขอบคุณ หรือตอบข้อสงสัยในนามร้านค้า', 'y': 230, 'bar_h': 40},
    {'from': 'actor', 'to': 'screen', 'msg': 'กดปุ่ม "ส่งคำตอบกลับ"', 'y': 260, 'bar_h': 40},
    {'from': 'screen', 'to': 'system', 'msg': 'ส่งคำขอตอบกลับ replyReview(reviewId, replyText, repliedBy)', 'y': 285, 'bar_h': 60},
    {'from': 'system', 'to': 'system', 'msg': 'ตรวจสอบว่าข้อความตอบกลับไม่ใช่ช่องว่าง (Non-empty check)', 'y': 310, 'is_self': True},
    # alt 1
    {'from': 'system', 'to': 'screen', 'msg': 'ข้อความว่าง: ส่งข้อผิดพลาด "กรุณากรอกข้อความตอบกลับ"', 'y': 385, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'แสดงข้อความแจ้งเตือน "กรุณากรอกข้อความตอบกลับ"', 'y': 405, 'is_return': True},
    # alt 2
    {'from': 'system', 'to': 'db', 'msg': 'INSERT INTO review_reply, UPDATE review SET status=\'PUBLISHED\'', 'y': 485, 'bar_h': 30},
    {'from': 'db', 'to': 'system', 'msg': 'ยืนยันบันทึกข้อความตอบกลับและปรับสถานะรีวิว', 'y': 510, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'ส่งผลการตอบกลับสำเร็จ และนำข้อความไปแสดงใต้รีวิวหน้าร้าน', 'y': 530, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'แสดงข้อความ "ตอบกลับรีวิวสำเร็จและเผยแพร่บนหน้าเว็บไซต์แล้ว"', 'y': 550, 'is_return': True},
]
u7_th_alt = {'y': 345, 'h': 245, 'div_y': 445, 'cond1': 'ข้อความตอบกลับเป็นช่องว่าง (Empty Reply Text)', 'cond2': 'มีข้อความตอบกลับที่ถูกต้อง (Valid Reply Text - Publish)'}

u7_en_steps = [
    {'from': 'actor', 'to': 'screen', 'msg': 'Select review and click "Reply to Review" button', 'y': 170, 'bar_h': 50},
    {'from': 'screen', 'to': 'actor', 'msg': 'Display modal with original review & reply input textarea', 'y': 200, 'is_return': True},
    {'from': 'actor', 'to': 'screen', 'msg': 'Type official clarification or thank-you response message', 'y': 230, 'bar_h': 40},
    {'from': 'actor', 'to': 'screen', 'msg': 'Click "Send Reply" button', 'y': 260, 'bar_h': 40},
    {'from': 'screen', 'to': 'system', 'msg': 'Send replyReview(reviewId, replyText, repliedBy) request', 'y': 285, 'bar_h': 60},
    {'from': 'system', 'to': 'system', 'msg': 'Validate that replyText is not empty or whitespace only', 'y': 310, 'is_self': True},
    # alt 1
    {'from': 'system', 'to': 'screen', 'msg': 'Validation error: "Reply text cannot be blank"', 'y': 385, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'Display warning alert "Please enter reply message"', 'y': 405, 'is_return': True},
    # alt 2
    {'from': 'system', 'to': 'db', 'msg': 'INSERT INTO review_reply, UPDATE review SET status=\'PUBLISHED\'', 'y': 485, 'bar_h': 30},
    {'from': 'db', 'to': 'system', 'msg': 'Confirm review reply stored and status updated', 'y': 510, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'Return reply success & render response under customer review', 'y': 530, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'Display "Reply Published Successfully & Displayed on Storefront"', 'y': 550, 'is_return': True},
]
u7_en_alt = {'y': 345, 'h': 245, 'div_y': 445, 'cond1': 'Reply Text is Blank / Whitespace', 'cond2': 'Valid Reply Text - Save & Publish'}

# --- U8 ---
u8_th_steps = [
    {'from': 'actor', 'to': 'screen', 'msg': 'เปิดเมนู "จัดการรีวิวที่มีปัญหา" (Review Manager Page)', 'y': 170, 'bar_h': 60},
    {'from': 'screen', 'to': 'system', 'msg': 'ดึงรายการรีวิวที่ถูกรายงานและกล่องสรุปสถานะ getReportedReviews()', 'y': 195, 'bar_h': 40},
    {'from': 'system', 'to': 'db', 'msg': 'SELECT * FROM review_report JOIN review ...', 'y': 215, 'bar_h': 20},
    {'from': 'db', 'to': 'system', 'msg': 'ส่งคืนรายการรีวิวที่ถูกรายงานและสถิติแต่ละสถานะ', 'y': 230, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'แสดงการ์ดสรุปสถานะ (รอตรวจ, สำเร็จ, ถูกซ่อน, ถูกลบ) และตารางรีวิว', 'y': 245, 'is_return': True},
    {'from': 'actor', 'to': 'screen', 'msg': 'เปิดดูรายละเอียดรีวิว เหตุผลการรายงาน และประวัติคำสั่งซื้อ', 'y': 275, 'bar_h': 40},
    # alt 1: Approve (Publish)
    {'from': 'actor', 'to': 'screen', 'msg': 'ผู้จัดการกด "อนุมัติ (Publish)" ยืนยันให้แสดงต่อหน้าร้าน', 'y': 365, 'bar_h': 50},
    {'from': 'screen', 'to': 'system', 'msg': 'resolveReport(reportId, action=\'APPROVE_PUBLISH\', managerName)', 'y': 390, 'bar_h': 40},
    {'from': 'system', 'to': 'db', 'msg': 'UPDATE review_report SET status=\'REJECTED\', review.status=\'PUBLISHED\'', 'y': 410, 'bar_h': 20},
    {'from': 'db', 'to': 'system', 'msg': 'ยืนยันปิดรายงานและแสดงรีวิวหน้าร้านตามปกติ', 'y': 425, 'is_return': True},
    # alt 2: Hide
    {'from': 'actor', 'to': 'screen', 'msg': 'ผู้จัดการกด "ซ่อนถาวร (Hide)" ระงับการแสดงผลจากหน้าร้าน', 'y': 495, 'bar_h': 50},
    {'from': 'screen', 'to': 'system', 'msg': 'resolveReport(reportId, action=\'HIDE\', managerName)', 'y': 520, 'bar_h': 40},
    {'from': 'system', 'to': 'db', 'msg': 'UPDATE review_report SET status=\'APPROVED\', review.status=\'HIDDEN\'', 'y': 540, 'bar_h': 20},
    {'from': 'db', 'to': 'system', 'msg': 'ยืนยันปรับสถานะเป็นซ่อนรีวิวถาวร', 'y': 555, 'is_return': True},
    # alt 3: Remove
    {'from': 'actor', 'to': 'screen', 'msg': 'ผู้จัดการกด "ลบรีวิว (Remove)" ถอดรีวิวออกจากระบบถาวร', 'y': 625, 'bar_h': 50},
    {'from': 'screen', 'to': 'system', 'msg': 'resolveReport(reportId, action=\'REMOVE\', managerName)', 'y': 650, 'bar_h': 40},
    {'from': 'system', 'to': 'db', 'msg': 'UPDATE review_report SET status=\'APPROVED\', review.status=\'REMOVED\'', 'y': 670, 'bar_h': 20},
    {'from': 'db', 'to': 'system', 'msg': 'ยืนยันถอดรีวิวออกจากระบบอย่างถาวร', 'y': 685, 'is_return': True},
    # finish
    {'from': 'system', 'to': 'screen', 'msg': 'ส่งผลการตัดสิน บันทึกชื่อผู้จัดการและเวลาปัจจุบันสำเร็จ', 'y': 720, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'แสดงข้อความ "บันทึกผลการตัดสินของผู้บริหารและปิดรายงานสมบูรณ์"', 'y': 740, 'is_return': True},
]
u8_th_alt = {'y': 325, 'h': 390, 'div_y': 465, 'cond1': 'ผู้จัดการอนุมัติให้แสดงต่อ (Publish Review & Reject Report)', 'cond2': 'ผู้จัดการสั่งซ่อนถาวร (Hide) หรือ สั่งลบถาวร (Remove)'}

u8_en_steps = [
    {'from': 'actor', 'to': 'screen', 'msg': 'Open "Review Manager" page (Review Manager Page)', 'y': 170, 'bar_h': 60},
    {'from': 'screen', 'to': 'system', 'msg': 'Request reported reviews list & status summary getReportedReviews()', 'y': 195, 'bar_h': 40},
    {'from': 'system', 'to': 'db', 'msg': 'SELECT * FROM review_report JOIN review ...', 'y': 215, 'bar_h': 20},
    {'from': 'db', 'to': 'system', 'msg': 'Return reported reviews dataset and metrics', 'y': 230, 'is_return': True},
    {'from': 'system', 'to': 'screen', 'msg': 'Display status cards (Pending, Resolved, Hidden, Removed) & table', 'y': 245, 'is_return': True},
    {'from': 'actor', 'to': 'screen', 'msg': 'Inspect review details, violation reason, and order context', 'y': 275, 'bar_h': 40},
    # alt 1: Approve
    {'from': 'actor', 'to': 'screen', 'msg': 'Manager clicks "Approve (Publish)" to allow review display', 'y': 365, 'bar_h': 50},
    {'from': 'screen', 'to': 'system', 'msg': 'resolveReport(reportId, action=\'APPROVE_PUBLISH\', managerName)', 'y': 390, 'bar_h': 40},
    {'from': 'system', 'to': 'db', 'msg': 'UPDATE review_report SET status=\'REJECTED\', review.status=\'PUBLISHED\'', 'y': 410, 'bar_h': 20},
    {'from': 'db', 'to': 'system', 'msg': 'Confirm report rejected & review marked PUBLISHED', 'y': 425, 'is_return': True},
    # alt 2: Hide
    {'from': 'actor', 'to': 'screen', 'msg': 'Manager clicks "Hide Permanently" (Keep in DB, suppress storefront)', 'y': 495, 'bar_h': 50},
    {'from': 'screen', 'to': 'system', 'msg': 'resolveReport(reportId, action=\'HIDE\', managerName)', 'y': 520, 'bar_h': 40},
    {'from': 'system', 'to': 'db', 'msg': 'UPDATE review_report SET status=\'APPROVED\', review.status=\'HIDDEN\'', 'y': 540, 'bar_h': 20},
    {'from': 'db', 'to': 'system', 'msg': 'Confirm review marked HIDDEN', 'y': 555, 'is_return': True},
    # alt 3: Remove
    {'from': 'actor', 'to': 'screen', 'msg': 'Manager clicks "Remove Review" (Permanently take down)', 'y': 625, 'bar_h': 50},
    {'from': 'screen', 'to': 'system', 'msg': 'resolveReport(reportId, action=\'REMOVE\', managerName)', 'y': 650, 'bar_h': 40},
    {'from': 'system', 'to': 'db', 'msg': 'UPDATE review_report SET status=\'APPROVED\', review.status=\'REMOVED\'', 'y': 670, 'bar_h': 20},
    {'from': 'db', 'to': 'system', 'msg': 'Confirm review marked REMOVED', 'y': 685, 'is_return': True},
    # finish
    {'from': 'system', 'to': 'screen', 'msg': 'Return decision execution confirmation with managerId and timestamp', 'y': 720, 'is_return': True},
    {'from': 'screen', 'to': 'actor', 'msg': 'Display "Review Decision Executed & Report Closed Successfully"', 'y': 740, 'is_return': True},
]
u8_en_alt = {'y': 325, 'h': 390, 'div_y': 465, 'cond1': 'Manager Approves Review (Publish Review & Close Report as Rejected)', 'cond2': 'Manager Enforces Action (Hide Review OR Remove Review Permanently)'}

# ==============================================================================
# BUILD DRAW.IO FILES
# ==============================================================================

th_configs = [
    ('u1_th', 'U1 จัดเตรียมและบรรจุพัสดุ (TH)', 'SD: U1 จัดเตรียมและบันทึกการบรรจุพัสดุ (Prepare Shipment & Packing)', 'พนักงานคลังสินค้า', 'หน้าจอรายการคำสั่งซื้อ', 'ระบบจัดการการจัดส่ง', 'ฐานข้อมูลการจัดส่ง', u1_th_steps, u1_th_alt),
    ('u2_th', 'U2 บันทึกข้อมูลการจัดส่งพัสดุ (TH)', 'SD: U2 บันทึกข้อมูลการจัดส่งพัสดุ (Record Delivery Info)', 'พนักงานจัดส่ง', 'หน้าจอบันทึกการจัดส่ง', 'ระบบจัดการการจัดส่ง', 'ฐานข้อมูลการจัดส่ง', u2_th_steps, u2_th_alt),
    ('u3_th', 'U3 ติดตามสถานะการจัดส่งพัสดุ (TH)', 'SD: U3 ติดตามสถานะการจัดส่งพัสดุ (Track Order Shipment)', 'ลูกค้า / พนักงานฝ่ายขาย', 'หน้าจอติดตามพัสดุ', 'ระบบจัดการการจัดส่ง', 'ฐานข้อมูลการจัดส่ง', u3_th_steps, u3_th_alt),
    ('u4_th', 'U4 จัดทำรายงานสรุปบัญชีจัดส่ง (TH)', 'SD: U4 จัดทำรายงานสรุปบัญชีพัสดุจัดส่ง (Generate Delivery Summary)', 'พนักงานจัดส่ง / ผู้จัดการร้าน', 'หน้าจอสรุปการจัดส่ง', 'ระบบจัดการการจัดส่ง', 'ฐานข้อมูลการจัดส่ง', u4_th_steps, u4_th_alt),
    ('u5_th', 'U5 ส่งข้อมูลรีวิวหนังสือ (TH)', 'SD: U5 ส่งข้อมูลรีวิวหนังสือของลูกค้า (Submit Book Review)', 'ลูกค้า', 'หน้าจอประวัติการสั่งซื้อ', 'ระบบจัดการรีวิวลูกค้า', 'ฐานข้อมูลรีวิว', u5_th_steps, u5_th_alt),
    ('u6_th', 'U6 ตรวจสอบกลั่นกรองรีวิว (TH)', 'SD: U6 ตรวจสอบและกลั่นกรองเนื้อหารีวิว (Moderate Content Review)', 'พนักงานฝ่ายขาย', 'หน้าจอตรวจสอบรีวิว', 'ระบบจัดการรีวิวลูกค้า', 'ฐานข้อมูลรีวิว', u6_th_steps, u6_th_alt),
    ('u7_th', 'U7 ตอบกลับรีวิวลูกค้า (TH)', 'SD: U7 ตอบกลับรีวิวลูกค้าอย่างเป็นทางการ (Reply to Customer Review)', 'พนักงานฝ่ายขาย / ผู้จัดการ', 'หน้าต่างตอบกลับรีวิว', 'ระบบจัดการรีวิวลูกค้า', 'ฐานข้อมูลรีวิว', u7_th_steps, u7_th_alt),
    ('u8_th', 'U8 จัดการรีวิวที่มีปัญหา (TH)', 'SD: U8 จัดการและพิจารณารีวิวที่มีปัญหา (Manage & Resolve Problematic Reviews)', 'ผู้จัดการร้าน', 'หน้าจอจัดการรีวิวที่มีปัญหา', 'ระบบจัดการรีวิวลูกค้า', 'ฐานข้อมูลรีวิว', u8_th_steps, u8_th_alt),
]

en_configs = [
    ('u1_en', 'U1 Prepare Shipment (EN)', 'SD: U1 Prepare Shipment & Packing (Prepare Shipment & Packing)', 'WarehouseStaff', 'Order Queue Screen', 'Delivery System', 'Delivery Database', u1_en_steps, u1_en_alt),
    ('u2_en', 'U2 Record Delivery Info (EN)', 'SD: U2 Record Delivery Info (Record Delivery Info)', 'DeliveryStaff', 'Delivery Screen', 'Delivery System', 'Delivery Database', u2_en_steps, u2_en_alt),
    ('u3_en', 'U3 Track Order Shipment (EN)', 'SD: U3 Track Order Shipment (Track Order Shipment)', 'Customer / SalesStaff', 'Tracking Screen', 'Delivery System', 'Delivery Database', u3_en_steps, u3_en_alt),
    ('u4_en', 'U4 Delivery Summary (EN)', 'SD: U4 Generate Delivery Summary (Generate Delivery Summary)', 'DeliveryStaff / StoreManager', 'Summary Report Screen', 'Delivery System', 'Delivery Database', u4_en_steps, u4_en_alt),
    ('u5_en', 'U5 Submit Book Review (EN)', 'SD: U5 Submit Book Review (Submit Book Review)', 'Customer', 'Order History Screen', 'Review System', 'Review Database', u5_en_steps, u5_en_alt),
    ('u6_en', 'U6 Moderate Content Review (EN)', 'SD: U6 Moderate Content Review (Moderate Content Review)', 'SalesStaff', 'Review Moderation Screen', 'Review System', 'Review Database', u6_en_steps, u6_en_alt),
    ('u7_en', 'U7 Reply to Customer Review (EN)', 'SD: U7 Reply to Customer Review (Reply to Customer Review)', 'SalesStaff / StoreManager', 'Review Reply Modal', 'Review System', 'Review Database', u7_en_steps, u7_en_alt),
    ('u8_en', 'U8 Manage Problematic Reviews (EN)', 'SD: U8 Manage & Resolve Problematic Reviews (Manage Problematic Reviews)', 'StoreManager', 'Review Manager Screen', 'Review System', 'Review Database', u8_en_steps, u8_en_alt),
]

# Generate XML tabs
th_tabs = [make_sequence_xml(*c) for c in th_configs]
en_tabs = [make_sequence_xml(*c) for c in en_configs]

# 1. Combined File (with both TH and EN tabs = 16 tabs)
combined_xml = ['<mxfile host="app.diagrams.net" modified="2026-09-10T10:00:00.000Z" agent="Antigravity" version="21.0.0" type="device">']
combined_xml.extend(th_tabs)
combined_xml.extend(en_tabs)
combined_xml.append('</mxfile>')
combined_content = '\n'.join(combined_xml)

# 2. Thai File (8 tabs)
th_file_xml = ['<mxfile host="app.diagrams.net" modified="2026-09-10T10:00:00.000Z" agent="Antigravity" version="21.0.0" type="device">']
th_file_xml.extend(th_tabs)
th_file_xml.append('</mxfile>')
th_content = '\n'.join(th_file_xml)

# 3. English File (8 tabs)
en_file_xml = ['<mxfile host="app.diagrams.net" modified="2026-09-10T10:00:00.000Z" agent="Antigravity" version="21.0.0" type="device">']
en_file_xml.extend(en_tabs)
en_file_xml.append('</mxfile>')
en_content = '\n'.join(en_file_xml)

# Save files
filenames_combined = ['Sequence_Diagrams.drawio', 'Sequence_Diagrams', 'SequenceDiagrams.drawio', 'SequenceDiagrams']
for fn in filenames_combined:
    with open(fn, 'w', encoding='utf-8') as f:
        f.write(combined_content)

with open('Sequence_Diagrams_TH.drawio', 'w', encoding='utf-8') as f:
    f.write(th_content)

with open('Sequence_Diagrams_EN.drawio', 'w', encoding='utf-8') as f:
    f.write(en_content)

print('Generated Sequence Diagrams successfully (Combined, Thai, English)!')
