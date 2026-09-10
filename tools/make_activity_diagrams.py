# -*- coding: utf-8 -*-
"""
Generate complete Activity Diagrams for Bookstore T03:
Delivery Subsystem (U1-U4) and Review Subsystem (U5-U8)
Matches the exact style of the user's uploaded example images:
- Outer canvas frame with top-left tab box
- 2 Swimlanes: [Actor] on Left, [ระบบ] on Right
- Initial black circle, rounded action boxes, diamond decisions, bullseye end states
- Clean orthogonal routing with Thai and English labels
"""
import os
import html

def make_node(node_id, val, x, y, w, h, style_type='action'):
    # Styles
    if style_type == 'action':
        style = 'shape=rect;rounded=1;arcSize=25;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1;fontSize=11;fontFamily=TH SarabunPSK, Tahoma, sans-serif;align=center;verticalAlign=middle;spacing=4;'
    elif style_type == 'decision':
        style = 'shape=rhombus;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1;fontSize=11;fontFamily=TH SarabunPSK, Tahoma, sans-serif;align=center;verticalAlign=middle;'
    elif style_type == 'start':
        style = 'shape=ellipse;fillColor=#000000;strokeColor=none;'
    elif style_type == 'end':
        style = 'ellipse;html=1;shape=endState;fillColor=#000000;strokeColor=#000000;strokeWidth=1.5;'
    else:
        style = ''
    
    val_escaped = html.escape(val).replace('\n', '&#xa;')
    return f'        <mxCell id="{node_id}" value="{val_escaped}" style="{style}" vertex="1" parent="1">\n          <mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry" />\n        </mxCell>'

def make_edge(edge_id, source_id, target_id, label='', exit_x=None, exit_y=None, entry_x=None, entry_y=None, points=None):
    style = 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1;endArrow=classic;endFill=1;fontSize=10;fontFamily=TH SarabunPSK, Tahoma, sans-serif;'
    if exit_x is not None and exit_y is not None:
        style += f'exitX={exit_x};exitY={exit_y};exitDx=0;exitDy=0;'
    if entry_x is not None and entry_y is not None:
        style += f'entryX={entry_x};entryY={entry_y};entryDx=0;entryDy=0;'
    
    lbl_escaped = html.escape(label).replace('\n', '&#xa;')
    points_xml = ''
    if points:
        pts = ''.join([f'<mxPoint x="{pt[0]}" y="{pt[1]}" />' for pt in points])
        points_xml = f'<Array as="points">{pts}</Array>'
    
    return f'        <mxCell id="{edge_id}" value="{lbl_escaped}" style="{style}" edge="1" parent="1" source="{source_id}" target="{target_id}">\n          <mxGeometry relative="1" as="geometry">{points_xml}</mxGeometry>\n        </mxCell>'

def build_tab(diagram_id, diagram_name, title_text, actor_name, nodes, edges):
    out = []
    out.append(f'  <diagram id="{diagram_id}" name="{html.escape(diagram_name)}">')
    out.append('    <mxGraphModel dx="1100" dy="950" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">')
    out.append('      <root>')
    out.append('        <mxCell id="0" />')
    out.append('        <mxCell id="1" parent="0" />')
    
    # Outer frame
    out.append(f'        <mxCell id="outer_frame_{diagram_id}" value="" style="shape=rect;html=1;whiteSpace=wrap;fillColor=none;strokeColor=#000000;strokeWidth=1.5;" vertex="1" parent="1">')
    out.append('          <mxGeometry x="60" y="40" width="700" height="780" as="geometry" />')
    out.append('        </mxCell>')
    
    # Top Tab Header (Angled / Folder tab style exactly like screenshot)
    out.append(f'        <mxCell id="tab_header_{diagram_id}" value="&lt;b&gt;{html.escape(title_text)}&lt;/b&gt;" style="shape=folder;tabWidth=450;tabHeight=28;tabPosition=left;html=1;whiteSpace=wrap;fillColor=none;strokeColor=#000000;strokeWidth=1.5;fontSize=12;fontFamily=TH SarabunPSK, Tahoma, sans-serif;spacingLeft=10;verticalAlign=middle;align=left;" vertex="1" parent="1">')
    out.append('          <mxGeometry x="60" y="40" width="460" height="28" as="geometry" />')
    out.append('        </mxCell>')
    
    # Swimlane frame
    out.append(f'        <mxCell id="swimlane_frame_{diagram_id}" value="" style="shape=rect;html=1;whiteSpace=wrap;fillColor=none;strokeColor=#000000;strokeWidth=1.5;" vertex="1" parent="1">')
    out.append('          <mxGeometry x="95" y="105" width="630" height="675" as="geometry" />')
    out.append('        </mxCell>')
    
    # Swimlane horizontal dividing line
    out.append(f'        <mxCell id="h_line_{diagram_id}" style="endArrow=none;html=1;strokeColor=#000000;strokeWidth=1.5;" edge="1" parent="1">')
    out.append('          <mxGeometry relative="1" as="geometry"><mxPoint x="95" y="135" as="sourcePoint" /><mxPoint x="725" y="135" as="targetPoint" /></mxGeometry>')
    out.append('        </mxCell>')
    
    # Swimlane vertical dividing line
    out.append(f'        <mxCell id="v_line_{diagram_id}" style="endArrow=none;html=1;strokeColor=#000000;strokeWidth=1.5;" edge="1" parent="1">')
    out.append('          <mxGeometry relative="1" as="geometry"><mxPoint x="410" y="105" as="sourcePoint" /><mxPoint x="410" y="780" as="targetPoint" /></mxGeometry>')
    out.append('        </mxCell>')
    
    # Header Actor Label
    out.append(f'        <mxCell id="lbl_actor_{diagram_id}" value="&lt;b&gt;{html.escape(actor_name)}&lt;/b&gt;" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;fontSize=13;fontFamily=TH SarabunPSK, Tahoma, sans-serif;" vertex="1" parent="1">')
    out.append('          <mxGeometry x="95" y="105" width="315" height="30" as="geometry" />')
    out.append('        </mxCell>')
    
    # Header System Label
    out.append(f'        <mxCell id="lbl_sys_{diagram_id}" value="&lt;b&gt;ระบบ&lt;/b&gt;" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;fontSize=13;fontFamily=TH SarabunPSK, Tahoma, sans-serif;" vertex="1" parent="1">')
    out.append('          <mxGeometry x="410" y="105" width="315" height="30" as="geometry" />')
    out.append('        </mxCell>')
    
    for n in nodes:
        out.append(n)
        
    for e in edges:
        out.append(e)
        
    out.append('      </root>')
    out.append('    </mxGraphModel>')
    out.append('  </diagram>')
    return '\n'.join(out)

tabs = []

# ==============================================================================
# TAB 1: U1 จัดเตรียมและบันทึกการบรรจุพัสดุ (Prepare Shipment & Packing)
# ==============================================================================
u1_nodes = [
    make_node('u1_start', '', 242, 155, 26, 26, 'start'),
    make_node('u1_act1', 'เปิดรายการออเดอร์ที่ต้องจัดของ\n(ออเดอร์สถานะ "ชำระเงินแล้ว")', 155, 210, 200, 50, 'action'),
    make_node('u1_act2', 'หยิบและแพ็กสินค้าลงกล่องพัสดุ\nตามรายการในออเดอร์', 155, 290, 200, 50, 'action'),
    make_node('u1_dec1', 'สินค้าในคลัง\nเพียงพอหรือไม่?', 185, 370, 140, 60, 'decision'),
    make_node('u1_act3', 'ระงับออเดอร์ไว้ชั่วคราว\nและแจ้งเตือนไปยังฝ่ายขายให้ตรวจสอบ', 465, 375, 210, 50, 'action'),
    make_node('u1_act4', 'กดปุ่ม "เริ่มแพ็กสินค้า" และ\n"แพ็กสินค้าเสร็จพร้อมส่ง"', 155, 475, 200, 50, 'action'),
    make_node('u1_act5', 'เปลี่ยนสถานะออเดอร์เป็น\n"พร้อมจัดส่ง"', 465, 475, 210, 50, 'action'),
    make_node('u1_end', '', 557, 570, 26, 26, 'end'),
]
u1_edges = [
    make_edge('u1_e1', 'u1_start', 'u1_act1'),
    make_edge('u1_e2', 'u1_act1', 'u1_act2'),
    make_edge('u1_e3', 'u1_act2', 'u1_dec1'),
    make_edge('u1_e4', 'u1_dec1', 'u1_act3', 'ไม่พอ (กดปุ่ม "สินค้าไม่เพียงพอ")', exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
    make_edge('u1_e5', 'u1_dec1', 'u1_act4', 'เพียงพอ', exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
    make_edge('u1_e6', 'u1_act4', 'u1_act5', '', exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
    make_edge('u1_e7', 'u1_act3', 'u1_end', '', exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0, points=[(570, 440), (570, 570)]),
    make_edge('u1_e8', 'u1_act5', 'u1_end', '', exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
]
tabs.append(build_tab('u1_tab', 'U1 จัดเตรียมและบรรจุพัสดุ', 'U1 จัดเตรียมและบันทึกการบรรจุพัสดุ (Prepare Shipment & Packing)', 'พนักงานคลังสินค้า', u1_nodes, u1_edges))

# ==============================================================================
# TAB 2: U2 บันทึกข้อมูลการจัดส่งพัสดุ (Record Delivery Info)
# ==============================================================================
u2_nodes = [
    make_node('u2_start', '', 242, 155, 26, 26, 'start'),
    make_node('u2_act1', 'เปิดหน้าคำสั่งซื้อลูกค้า และเลือกรายการ\nที่ต้องการบันทึกการจัดส่ง', 150, 205, 210, 50, 'action'),
    make_node('u2_act2', 'กดปุ่ม "บันทึกการจัดส่ง"', 175, 280, 160, 40, 'action'),
    make_node('u2_act3', 'เลือกบริษัทขนส่ง (Carrier) และ\nกรอกหมายเลขพัสดุ (Tracking No.)', 150, 345, 210, 50, 'action'),
    make_node('u2_act4', 'กดปุ่ม "บันทึกข้อมูลการจัดส่ง"', 175, 420, 160, 40, 'action'),
    make_node('u2_dec1', 'ตรวจสอบความถูกต้อง\nและเลขพัสดุไม่ซ้ำ?', 485, 405, 170, 70, 'decision'),
    make_node('u2_act5', 'แสดงข้อความแจ้งเตือนข้อผิดพลาด\nและไม่อนุญาตให้บันทึกจนกว่าจะแก้ไข', 465, 305, 210, 50, 'action'),
    make_node('u2_act6', 'บันทึกเลขพัสดุลงฐานข้อมูล และ\nเปลี่ยนสถานะพัสดุเป็น "จัดส่งแล้ว"', 465, 520, 210, 50, 'action'),
    make_node('u2_act7', 'ส่งการแจ้งเตือนหมายเลขพัสดุและลิงก์\nติดตามสถานะไปยังบัญชีลูกค้าอัตโนมัติ', 465, 595, 210, 50, 'action'),
    make_node('u2_end', '', 557, 680, 26, 26, 'end'),
]
u2_edges = [
    make_edge('u2_e1', 'u2_start', 'u2_act1'),
    make_edge('u2_e2', 'u2_act1', 'u2_act2'),
    make_edge('u2_e3', 'u2_act2', 'u2_act3'),
    make_edge('u2_e4', 'u2_act3', 'u2_act4'),
    make_edge('u2_e5', 'u2_act4', 'u2_dec1', '', exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
    make_edge('u2_e6', 'u2_dec1', 'u2_act5', 'ไม่ถูกต้อง / ซ้ำ', exit_x=0.5, exit_y=0, entry_x=0.5, entry_y=1),
    make_edge('u2_e7', 'u2_act5', 'u2_act3', 'กลับไปแก้ไข', exit_x=0, exit_y=0.5, entry_x=1, entry_y=0.5),
    make_edge('u2_e8', 'u2_dec1', 'u2_act6', 'ถูกต้อง', exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
    make_edge('u2_e9', 'u2_act6', 'u2_act7'),
    make_edge('u2_e10', 'u2_act7', 'u2_end'),
]
tabs.append(build_tab('u2_tab', 'U2 บันทึกข้อมูลการจัดส่งพัสดุ', 'U2 บันทึกข้อมูลการจัดส่งพัสดุ (Record Delivery Info)', 'พนักงานจัดส่ง', u2_nodes, u2_edges))

# ==============================================================================
# TAB 3: U3 ติดตามสถานะการจัดส่งพัสดุ (Track Order Shipment)
# ==============================================================================
u3_nodes = [
    make_node('u3_start', '', 242, 155, 26, 26, 'start'),
    make_node('u3_act1', 'ล็อกอินและเลือกเมนู\n"คำสั่งซื้อ / ติดตามพัสดุ"', 155, 210, 200, 50, 'action'),
    make_node('u3_act2', 'แสดงหน้ารายการคำสั่งซื้อ\nและประวัติการสั่งซื้อทั้งหมด', 465, 210, 210, 50, 'action'),
    make_node('u3_act3', 'เลือกรายการหนังสือ / ออเดอร์\nที่ต้องการตรวจสอบสถานะ', 155, 335, 200, 50, 'action'),
    make_node('u3_dec1', 'พบข้อมูลการจัดส่ง\nในระบบ?', 495, 330, 150, 60, 'decision'),
    make_node('u3_act4', 'ดึงข้อมูลผู้รับ ขนส่ง หมายเลขพัสดุ\nสถานะปัจจุบัน และไทม์ไลน์มาแสดงผล', 465, 450, 210, 55, 'action'),
    make_node('u3_act5', 'คลิก "ปุ่มคัดลอก" เพื่อเปิดหน้าเว็บ\nตรวจสอบภายนอกของบริษัทขนส่ง', 155, 450, 200, 55, 'action'),
    make_node('u3_act6', 'แสดงข้อความ\n"ทางร้านกำลังจัดเตรียมและแพ็กสินค้าเพื่อจัดส่ง"', 460, 570, 220, 50, 'action'),
    make_node('u3_end1', '', 242, 575, 26, 26, 'end'),
    make_node('u3_end2', '', 557, 675, 26, 26, 'end'),
]
u3_edges = [
    make_edge('u3_e1', 'u3_start', 'u3_act1'),
    make_edge('u3_e2', 'u3_act1', 'u3_act2', '', exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
    make_edge('u3_e3', 'u3_act2', 'u3_act3', '', exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0, points=[(570, 290), (255, 290)]),
    make_edge('u3_e4', 'u3_act3', 'u3_dec1', '', exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
    make_edge('u3_e5', 'u3_dec1', 'u3_act4', 'พบ', exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
    make_edge('u3_e6', 'u3_dec1', 'u3_act6', 'ไม่พบ', exit_x=1, exit_y=0.5, entry_x=1, entry_y=0.5, points=[(685, 360), (685, 595)]),
    make_edge('u3_e7', 'u3_act4', 'u3_act5', 'ผู้ใช้ตรวจสอบ', exit_x=0, exit_y=0.5, entry_x=1, entry_y=0.5),
    make_edge('u3_e8', 'u3_act5', 'u3_end1'),
    make_edge('u3_e9', 'u3_act6', 'u3_end2'),
]
tabs.append(build_tab('u3_tab', 'U3 ติดตามสถานะการจัดส่งพัสดุ', 'U3 ติดตามสถานะการจัดส่งพัสดุ (Track Order Shipment)', 'ลูกค้า / พนักงานฝ่ายขาย', u3_nodes, u3_edges))

# ==============================================================================
# TAB 4: U4 จัดทำรายงานสรุปบัญชีพัสดุจัดส่ง (Generate Delivery Summary)
# ==============================================================================
u4_nodes = [
    make_node('u4_start', '', 242, 155, 26, 26, 'start'),
    make_node('u4_act1', 'เปิดเมนู "สรุปการจัดส่งพัสดุ"\n(Delivery Summary Report)', 155, 210, 200, 50, 'action'),
    make_node('u4_act2', 'แสดงหน้าจอตัวกรองช่วงวันที่ (Date Range)\nหรือตัวเลือกสรุปยอดประจำวัน', 465, 210, 210, 50, 'action'),
    make_node('u4_act3', 'เลือกช่วงวันที่ที่ต้องการออกรายงาน\nและกดปุ่ม "ประมวลผลรายงาน"', 155, 315, 200, 50, 'action'),
    make_node('u4_dec1', 'มีข้อมูลการจัดส่ง\nในช่วงเวลาที่ระบุ?', 495, 310, 150, 60, 'decision'),
    make_node('u4_act4', 'แสดงสถานะ Empty State แจ้งว่า\n"ไม่พบรายการจัดส่งในช่วงเวลาที่ระบุ"', 465, 415, 210, 50, 'action'),
    make_node('u4_act5', 'ประมวลผลคำนวณยอดพัสดุ สถิติแยกตามขนส่ง\nและจำนวนส่งสำเร็จ แสดงในรูปแบบตารางและกราฟ', 460, 505, 220, 60, 'action'),
    make_node('u4_act6', 'กดปุ่ม "ส่งออกรายงาน (Export CSV/PDF)"\nเพื่อส่งต่อให้ผู้จัดการร้านตรวจสอบ', 150, 510, 210, 50, 'action'),
    make_node('u4_end1', '', 560, 485, 24, 24, 'end'),
    make_node('u4_end2', '', 243, 605, 26, 26, 'end'),
]
u4_edges = [
    make_edge('u4_e1', 'u4_start', 'u4_act1'),
    make_edge('u4_e2', 'u4_act1', 'u4_act2', '', exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
    make_edge('u4_e3', 'u4_act2', 'u4_act3', '', exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0, points=[(570, 280), (255, 280)]),
    make_edge('u4_e4', 'u4_act3', 'u4_dec1', '', exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
    make_edge('u4_e5', 'u4_dec1', 'u4_act4', 'ไม่มีข้อมูล', exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
    make_edge('u4_e6', 'u4_dec1', 'u4_act5', 'มีข้อมูล', exit_x=1, exit_y=0.5, entry_x=1, entry_y=0.5, points=[(685, 340), (685, 535)]),
    make_edge('u4_e7', 'u4_act4', 'u4_end1'),
    make_edge('u4_e8', 'u4_act5', 'u4_act6', '', exit_x=0, exit_y=0.5, entry_x=1, entry_y=0.5),
    make_edge('u4_e9', 'u4_act6', 'u4_end2'),
]
tabs.append(build_tab('u4_tab', 'U4 จัดทำรายงานสรุปบัญชีพัสดุจัดส่ง', 'U4 จัดทำรายงานสรุปบัญชีพัสดุจัดส่ง (Generate Delivery Summary)', 'พนักงานจัดส่ง / ผู้จัดการร้าน', u4_nodes, u4_edges))

# ==============================================================================
# TAB 5: U5 ส่งข้อมูลรีวิวหนังสือของลูกค้า (Submit Book Review)
# ==============================================================================
u5_nodes = [
    make_node('u5_start', '', 242, 155, 26, 26, 'start'),
    make_node('u5_act1', 'เข้าสู่ระบบ และไปที่หน้า\n"ประวัติการสั่งซื้อ"', 155, 210, 200, 50, 'action'),
    make_node('u5_dec1', 'คำสั่งซื้อมีสถานะเป็น\n"จัดส่งสำเร็จ" หรือไม่?', 490, 205, 160, 60, 'decision'),
    make_node('u5_act2', 'ไม่แสดงปุ่มเขียนรีวิว\n(แสดงสถานะคำสั่งซื้อตามจริง)', 465, 295, 210, 45, 'action'),
    make_node('u5_act3', 'แสดงกล่องเขียนรีวิว "แสดงดาวให้คะแนน"\nและปุ่ม "ส่งรีวิว"', 465, 365, 210, 50, 'action'),
    make_node('u5_act4', 'คลิกเลือกดาวให้คะแนน และพิมพ์\nข้อความรีวิวแสดงความคิดเห็น', 155, 365, 200, 50, 'action'),
    make_node('u5_act5', 'กดปุ่ม "ส่งรีวิว"', 175, 445, 160, 40, 'action'),
    make_node('u5_dec2', 'ระบุคะแนนดาวและ\nข้อความครบถ้วน?', 495, 435, 150, 60, 'decision'),
    make_node('u5_act6', 'ระบบแจ้งเตือน "กรุณาระบุคะแนน\nและพิมพ์ข้อความรีวิว"', 465, 520, 210, 45, 'action'),
    make_node('u5_act7', 'เรียกใช้ตัวกรองคำหยาบคาย\n(Profanity Filter) บันทึกลงฐานข้อมูล\nและแสดงข้อความยืนยันสำเร็จ', 460, 595, 220, 60, 'action'),
    make_node('u5_end1', '', 560, 345, 20, 20, 'end'),
    make_node('u5_end2', '', 560, 685, 26, 26, 'end'),
]
u5_edges = [
    make_edge('u5_e1', 'u5_start', 'u5_act1'),
    make_edge('u5_e2', 'u5_act1', 'u5_dec1', '', exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
    make_edge('u5_e3', 'u5_dec1', 'u5_act2', 'ยังไม่สำเร็จ', exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
    make_edge('u5_e4', 'u5_act2', 'u5_end1'),
    make_edge('u5_e5', 'u5_dec1', 'u5_act3', 'จัดส่งสำเร็จ', exit_x=1, exit_y=0.5, entry_x=1, entry_y=0.5, points=[(685, 235), (685, 390)]),
    make_edge('u5_e6', 'u5_act3', 'u5_act4', '', exit_x=0, exit_y=0.5, entry_x=1, entry_y=0.5),
    make_edge('u5_e7', 'u5_act4', 'u5_act5'),
    make_edge('u5_e8', 'u5_act5', 'u5_dec2', '', exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
    make_edge('u5_e9', 'u5_dec2', 'u5_act6', 'ไม่ครบ', exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
    make_edge('u5_e10', 'u5_act6', 'u5_act4', 'กลับไปกรอก', exit_x=0, exit_y=0.5, entry_x=0.5, entry_y=1, points=[(410, 542), (255, 542)]),
    make_edge('u5_e11', 'u5_dec2', 'u5_act7', 'ครบถ้วน', exit_x=1, exit_y=0.5, entry_x=1, entry_y=0.5, points=[(685, 465), (685, 625)]),
    make_edge('u5_e12', 'u5_act7', 'u5_end2'),
]
tabs.append(build_tab('u5_tab', 'U5 ส่งข้อมูลรีวิวหนังสือของลูกค้า', 'U5 ส่งข้อมูลรีวิวหนังสือของลูกค้า (Submit Book Review)', 'ลูกค้า', u5_nodes, u5_edges))

# ==============================================================================
# TAB 6: U6 ตรวจสอบและกลั่นกรองเนื้อหารีวิว (Moderate Content Review)
# ==============================================================================
u6_nodes = [
    make_node('u6_start', '', 242, 155, 26, 26, 'start'),
    make_node('u6_act1', 'เข้าสู่ระบบหลังบ้าน และเปิดเมนู\n"ตรวจสอบรีวิว" (Review Moderation)', 155, 210, 200, 50, 'action'),
    make_node('u6_act2', 'แสดงรายการรีวิวทั้งหมดในระบบ พร้อม\nตัวกรองและป้ายสถานะรีวิวที่ติดธง (Flagged)', 465, 210, 210, 55, 'action'),
    make_node('u6_act3', 'คลิกเปิดอ่านรายละเอียดรีวิว\nเพื่อตรวจสอบความถูกต้องของเนื้อหา', 155, 310, 200, 50, 'action'),
    make_node('u6_dec1', 'พิจารณาการดำเนินการ\nต่อเนื้อหารีวิว?', 185, 400, 140, 65, 'decision'),
    make_node('u6_act4', 'กดปุ่ม "ตอบกลับรีวิว"\n(เพื่อชี้แจงลูกค้า ไปยัง U7)', 155, 505, 200, 45, 'action'),
    make_node('u6_act5', 'กดปุ่ม "รายงานผู้จัดการ (Report)"\nพร้อมระบุเหตุผลและคำอธิบาย', 465, 405, 210, 55, 'action'),
    make_node('u6_act6', 'บันทึกการตัดสินและปรับปรุงสถานะ\nส่งรายงานเข้าคิวผู้จัดการร้านทันที', 465, 495, 210, 55, 'action'),
    make_node('u6_end1', '', 242, 595, 26, 26, 'end'),
    make_node('u6_end2', '', 570, 595, 26, 26, 'end'),
]
u6_edges = [
    make_edge('u6_e1', 'u6_start', 'u6_act1'),
    make_edge('u6_e2', 'u6_act1', 'u6_act2', '', exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
    make_edge('u6_e3', 'u6_act2', 'u6_act3', '', exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0, points=[(570, 285), (255, 285)]),
    make_edge('u6_e4', 'u6_act3', 'u6_dec1'),
    make_edge('u6_e5', 'u6_dec1', 'u6_act4', 'ต้องการตอบกลับ', exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
    make_edge('u6_e6', 'u6_dec1', 'u6_act5', 'พบปัญหา/รายงาน', exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
    make_edge('u6_e7', 'u6_act5', 'u6_act6'),
    make_edge('u6_e8', 'u6_act4', 'u6_end1'),
    make_edge('u6_e9', 'u6_act6', 'u6_end2'),
]
tabs.append(build_tab('u6_tab', 'U6 ตรวจสอบและกลั่นกรองเนื้อหารีวิว', 'U6 ตรวจสอบและกลั่นกรองเนื้อหารีวิว (Moderate Content Review)', 'พนักงานฝ่ายขาย', u6_nodes, u6_edges))

# ==============================================================================
# TAB 7: U7 ตอบกลับรีวิวลูกค้าอย่างเป็นทางการ (Reply to Customer Review)
# ==============================================================================
u7_nodes = [
    make_node('u7_start', '', 242, 155, 26, 26, 'start'),
    make_node('u7_act1', 'เลือกรายการรีวิวที่ต้องการ และ\nกดปุ่ม "ตอบกลับรีวิว" (Reply)', 155, 210, 200, 50, 'action'),
    make_node('u7_act2', 'แสดงหน้าต่าง Modal ข้อมูลรีวิวเดิม\nพร้อมช่องกรอกข้อความตอบกลับ', 465, 210, 210, 50, 'action'),
    make_node('u7_act3', 'พิมพ์ข้อความชี้แจง ตอบข้อสงสัย\nหรือแสดงความขอบคุณในนามร้านค้า', 155, 310, 200, 50, 'action'),
    make_node('u7_act4', 'กดปุ่ม "ส่งคำตอบกลับ"', 175, 390, 160, 40, 'action'),
    make_node('u7_dec1', 'ข้อความตอบกลับ\nเป็นช่องว่างหรือไม่?', 495, 380, 150, 60, 'decision'),
    make_node('u7_act5', 'แสดงข้อความแจ้งเตือน\n"กรุณากรอกข้อความตอบกลับ"', 465, 470, 210, 45, 'action'),
    make_node('u7_act6', 'บันทึกข้อความตอบกลับลงฐานข้อมูล และ\nปรับสถานะรีวิวเป็น "เผยแพร่แล้ว"', 465, 545, 210, 50, 'action'),
    make_node('u7_act7', 'นำข้อความตอบกลับไปแสดงผล\nใต้รีวิวบนหน้าเว็บไซต์ทันที', 465, 620, 210, 50, 'action'),
    make_node('u7_end', '', 570, 705, 26, 26, 'end'),
]
u7_edges = [
    make_edge('u7_e1', 'u7_start', 'u7_act1'),
    make_edge('u7_e2', 'u7_act1', 'u7_act2', '', exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
    make_edge('u7_e3', 'u7_act2', 'u7_act3', '', exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0, points=[(570, 280), (255, 280)]),
    make_edge('u7_e4', 'u7_act3', 'u7_act4'),
    make_edge('u7_e5', 'u7_act4', 'u7_dec1', '', exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
    make_edge('u7_e6', 'u7_dec1', 'u7_act5', 'ช่องว่าง', exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
    make_edge('u7_e7', 'u7_act5', 'u7_act3', 'กลับไปกรอก', exit_x=0, exit_y=0.5, entry_x=0.5, entry_y=1, points=[(410, 492), (255, 492)]),
    make_edge('u7_e8', 'u7_dec1', 'u7_act6', 'มีข้อความ', exit_x=1, exit_y=0.5, entry_x=1, entry_y=0.5, points=[(685, 410), (685, 570)]),
    make_edge('u7_e9', 'u7_act6', 'u7_act7'),
    make_edge('u7_e10', 'u7_act7', 'u7_end'),
]
tabs.append(build_tab('u7_tab', 'U7 ตอบกลับรีวิวลูกค้าอย่างเป็นทางการ', 'U7 ตอบกลับรีวิวลูกค้าอย่างเป็นทางการ (Reply to Customer Review)', 'พนักงานฝ่ายขาย / ผู้จัดการร้าน', u7_nodes, u7_edges))

# ==============================================================================
# TAB 8: U8 จัดการและพิจารณารีวิวที่มีปัญหา (Manage & Resolve Problematic Reviews)
# ==============================================================================
u8_nodes = [
    make_node('u8_start', '', 242, 155, 26, 26, 'start'),
    make_node('u8_act1', 'เปิดเมนู "จัดการรีวิวที่มีปัญหา"\n(Review Manager Page)', 155, 210, 200, 50, 'action'),
    make_node('u8_act2', 'แสดงรายการรีวิวที่ถูกรายงาน พร้อมกล่องสรุปสถานะ\n(รอตรวจ, ตรวจสำเร็จ, ถูกซ่อน, ถูกลบ)', 465, 210, 210, 55, 'action'),
    make_node('u8_act3', 'เปิดดูรายละเอียดรีวิว เหตุผลการรายงาน\nและประวัติคำสั่งซื้อที่เกี่ยวข้อง', 155, 305, 200, 50, 'action'),
    make_node('u8_dec1', 'ผู้จัดการร้านใช้อำนาจบริหาร\nตัดสินใจเลือกดำเนินการ?', 175, 395, 160, 65, 'decision'),
    make_node('u8_act4', 'กดปุ่ม "อนุมัติ (Publish)"\nยืนยันให้รีวิวแสดงผลต่อหน้าร้าน', 150, 495, 210, 45, 'action'),
    make_node('u8_act5', 'กดปุ่ม "ซ่อนถาวร (Hide)"\nระงับการแสดงผลจากหน้าร้าน', 150, 565, 210, 45, 'action'),
    make_node('u8_act6', 'กดปุ่ม "ลบรีวิว (Remove)"\nถอดรีวิวออกจากระบบอย่างถาวร', 150, 635, 210, 45, 'action'),
    make_node('u8_act7', 'บันทึกผลการตัดสิน บันทึกชื่อผู้จัดการ\nและปรับปรุงสถานะรีวิวและรายงานพร้อมกัน', 465, 545, 210, 60, 'action'),
    make_node('u8_end', '', 570, 645, 26, 26, 'end'),
]
u8_edges = [
    make_edge('u8_e1', 'u8_start', 'u8_act1'),
    make_edge('u8_e2', 'u8_act1', 'u8_act2', '', exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
    make_edge('u8_e3', 'u8_act2', 'u8_act3', '', exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0, points=[(570, 280), (255, 280)]),
    make_edge('u8_e4', 'u8_act3', 'u8_dec1'),
    make_edge('u8_e5', 'u8_dec1', 'u8_act4', 'อนุมัติ', exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
    make_edge('u8_e6', 'u8_dec1', 'u8_act5', 'ซ่อนรีวิว', exit_x=0, exit_y=0.5, entry_x=0, entry_y=0.5, points=[(120, 427), (120, 587)]),
    make_edge('u8_e7', 'u8_dec1', 'u8_act6', 'ลบรีวิว', exit_x=0, exit_y=0.5, entry_x=0, entry_y=0.5, points=[(105, 427), (105, 657)]),
    make_edge('u8_e8', 'u8_act4', 'u8_act7', '', exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
    make_edge('u8_e9', 'u8_act5', 'u8_act7', '', exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
    make_edge('u8_e10', 'u8_act6', 'u8_act7', '', exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
    make_edge('u8_e11', 'u8_act7', 'u8_end'),
]
tabs.append(build_tab('u8_tab', 'U8 จัดการและพิจารณารีวิวที่มีปัญหา', 'U8 จัดการและพิจารณารีวิวที่มีปัญหา (Manage & Resolve Problematic Reviews)', 'ผู้จัดการร้าน', u8_nodes, u8_edges))

# Combine all tabs into mxfile
xml_full = [
    '<mxfile host="app.diagrams.net" modified="2026-09-10T03:00:00.000Z" agent="Antigravity" version="21.0.0" type="device">'
]
xml_full.extend(tabs)
xml_full.append('</mxfile>')

final_content = '\n'.join(xml_full)

# Save as 'Activity Diagram_drow.drawio' as requested
with open('Activity Diagram_drow.drawio', 'w', encoding='utf-8') as f:
    f.write(final_content)

# Also save without spaces or variants so user can find it easily
with open('Activity_Diagram_drow.drawio', 'w', encoding='utf-8') as f:
    f.write(final_content)

print('Saved Activity Diagram_drow.drawio and Activity_Diagram_drow.drawio with 8 tabs successfully!')
