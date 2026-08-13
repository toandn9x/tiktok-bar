Shader "Custom/LightPool"
{
    Properties
    {
        _Color ("Tint", Color) = (1,1,1,1)
        _Softness ("Edge Softness", Range(0.5, 5)) = 2.2
        // 0 = vung sang dac, 1 = vong gobo dut net
        _Mode ("Mode", Float) = 0
        _RingWidth ("Ring Width", Range(0.02, 0.6)) = 0.16
        _Dashes ("Dash Count", Range(0, 48)) = 18
        _Spin ("Spin", Float) = 0
    }
    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" "IgnoreProjector"="True" }
        LOD 100

        // Blend cong: mau cua quad duoc CONG vao nhung gi da ve truoc do.
        // Nho vay vung sang chi lam sang them anh nen chu khong bao gio che no,
        // khac han mot mat san duc.
        Blend SrcAlpha One
        ZWrite Off
        Cull Off

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            struct appdata_t
            {
                float4 vertex : POSITION;
                float2 texcoord : TEXCOORD0;
            };

            struct v2f
            {
                float4 vertex : SV_POSITION;
                float2 texcoord : TEXCOORD0;
            };

            fixed4 _Color;
            float _Softness;
            float _Mode;
            float _RingWidth;
            float _Dashes;
            float _Spin;

            v2f vert (appdata_t v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                o.texcoord = v.texcoord;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float2 d = i.texcoord - float2(0.5, 0.5);
                float dist = saturate(length(d) * 2.0);
                float falloff;

                if (_Mode < 0.5)
                {
                    // Vung sang hinh elip, mo dan tu tam ra vien
                    falloff = pow(saturate(1.0 - dist), _Softness);
                }
                else
                {
                    // Vong gobo dut net: mot vanh mong bi cat thanh tung doan,
                    // giong den moving head chieu hoa van xuong san.
                    float ring = 1.0 - saturate(abs(dist - 0.74) / _RingWidth);
                    ring = pow(ring, 1.6);

                    float angle = atan2(d.y, d.x) * 0.15915494 + 0.5;   // 0..1
                    float seg = frac(angle * _Dashes + _Spin);

                    // Luon viet dang 1 - smoothstep(min, max, x) voi min < max.
                    // Dang dao nguoc smoothstep(max, min, x) khong duoc bao dam
                    // giong nhau giua cac trinh bien dich shader.
                    float dash = 1.0 - smoothstep(0.40, 0.58, seg);
                    float edge = 1.0 - smoothstep(0.92, 1.0, dist);

                    falloff = ring * dash * edge;
                }

                fixed4 col = _Color;
                col.a *= falloff;
                return col;
            }
            ENDCG
        }
    }
    Fallback Off
}
